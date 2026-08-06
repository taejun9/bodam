use super::archive::preflight_xlsx;
use super::constants::{FIELD_KEYS, HEADERS, MAX_DATA_ROWS, TARGET_SHEET};
use super::error::ImportFileError;
use super::model::{
    ImportCellIssue, ImportFileFormat, ImportSourceCells, ImportSourceRow, ParsedImportFile,
};
use super::parser::{validate_cell_length, validate_header_cell};
use super::xlsx_resources::LogicalTextBudget;
use calamine::{DataRef, Reader, Xlsx};
use std::io::Cursor;
use unicode_normalization::UnicodeNormalization;

const MAX_XLSX_ROW_INDEX: u32 = 1_048_575;
const MAX_XLSX_COLUMN_INDEX: u32 = 16_383;

pub(crate) fn parse_xlsx(
    basename: String,
    bytes: &[u8],
) -> Result<ParsedImportFile, ImportFileError> {
    preflight_xlsx(bytes)?;
    let mut workbook: Xlsx<_> = Xlsx::new(Cursor::new(bytes)).map_err(|_| workbook_invalid())?;
    let sheet_name = target_sheet_name(&workbook)?;
    let mut reader = workbook
        .worksheet_cells_reader(&sheet_name)
        .map_err(|_| workbook_invalid())?;

    let mut header_values: [Option<String>; 21] = std::array::from_fn(|_| None);
    let mut invalid_headers = [false; 21];
    let mut previous_position = None;
    let mut active_row: Option<RowAccumulator> = None;
    let mut rows = Vec::new();
    let mut issues = Vec::new();
    let mut logical_text = LogicalTextBudget::new();

    while let Some(cell) = reader
        .next_cell_with_formula_metadata()
        .map_err(|_| workbook_invalid())?
    {
        logical_text.include(&cell.value, cell.formula.as_ref())?;
        if previous_position.is_some_and(|position| cell.pos <= position) {
            return Err(workbook_invalid());
        }
        previous_position = Some(cell.pos);
        let (row_index, column_index) = cell.pos;
        if row_index > MAX_XLSX_ROW_INDEX || column_index > MAX_XLSX_COLUMN_INDEX {
            return Err(workbook_invalid());
        }
        let formula = cell.formula.is_some();
        let blank = is_blank(&cell.value);

        if column_index >= HEADERS.len() as u32 {
            if formula || !blank {
                return Err(extra_column_error());
            }
            continue;
        }
        let column = column_index as usize;
        if row_index == 0 {
            set_header(
                column,
                cell.value,
                formula,
                &mut header_values,
                &mut invalid_headers,
            );
            continue;
        }
        if !formula && blank {
            continue;
        }
        if active_row
            .as_ref()
            .is_some_and(|row| row.row_index != row_index)
        {
            finish_row(&mut active_row, &mut rows, &mut issues)?;
        }
        let row = active_row.get_or_insert_with(|| RowAccumulator::new(row_index));
        row.set_cell(column, cell.value, formula)?;
    }
    finish_row(&mut active_row, &mut rows, &mut issues)?;
    validate_headers(&header_values, &invalid_headers)?;

    if rows.is_empty() {
        return Err(ImportFileError::new(
            "NO_DATA_ROWS",
            "가져올 계약 행이 없습니다.",
        ));
    }
    Ok(ParsedImportFile {
        basename,
        format: ImportFileFormat::Xlsx,
        rows,
        issues,
    })
}

struct RowAccumulator {
    row_index: u32,
    columns: [Option<String>; 21],
    issues: Vec<ImportCellIssue>,
}

impl RowAccumulator {
    fn new(row_index: u32) -> Self {
        Self {
            row_index,
            columns: std::array::from_fn(|_| None),
            issues: Vec::new(),
        }
    }

    fn set_cell(
        &mut self,
        column: usize,
        value: DataRef<'_>,
        formula: bool,
    ) -> Result<(), ImportFileError> {
        let source_row = self.row_index + 1;
        if formula {
            self.issues.push(cell_issue(
                source_row,
                column,
                "FORMULA_CELL",
                "수식 셀은 가져올 수 없습니다.",
            ));
            return Ok(());
        }
        match value {
            DataRef::String(value) => self.set_owned_text(column, source_row, value),
            DataRef::SharedString(value) => self.set_text(column, source_row, value),
            DataRef::Empty => Ok(()),
            _ => {
                self.issues.push(cell_issue(
                    source_row,
                    column,
                    "NON_TEXT_CELL",
                    "텍스트가 아닌 셀은 가져올 수 없습니다.",
                ));
                Ok(())
            }
        }
    }

    fn set_owned_text(
        &mut self,
        column: usize,
        source_row: u32,
        value: String,
    ) -> Result<(), ImportFileError> {
        validate_cell_length(&value, source_row, column)?;
        if !value.is_empty() {
            self.columns[column] = Some(value);
        }
        Ok(())
    }

    fn set_text(
        &mut self,
        column: usize,
        source_row: u32,
        value: &str,
    ) -> Result<(), ImportFileError> {
        validate_cell_length(value, source_row, column)?;
        if !value.is_empty() {
            self.columns[column] = Some(value.to_owned());
        }
        Ok(())
    }
}

fn target_sheet_name(workbook: &Xlsx<Cursor<&[u8]>>) -> Result<String, ImportFileError> {
    let target_names = workbook
        .sheet_names()
        .into_iter()
        .filter(|name| name.nfc().eq(TARGET_SHEET.nfc()))
        .collect::<Vec<_>>();
    match target_names.as_slice() {
        [] => Err(ImportFileError::new(
            "TARGET_SHEET_MISSING",
            "계약조회 대상 sheet를 찾을 수 없습니다.",
        )),
        [name] => Ok(name.clone()),
        _ => Err(ImportFileError::new(
            "TARGET_SHEET_DUPLICATE",
            "계약조회 대상 sheet가 중복되었습니다.",
        )),
    }
}

fn set_header(
    column: usize,
    value: DataRef<'_>,
    formula: bool,
    headers: &mut [Option<String>; 21],
    invalid: &mut [bool; 21],
) {
    if formula {
        invalid[column] = true;
        return;
    }
    match value {
        DataRef::String(value) => headers[column] = Some(value),
        DataRef::SharedString(value) => headers[column] = Some(value.to_owned()),
        DataRef::Empty => {}
        _ => invalid[column] = true,
    }
}

fn validate_headers(
    headers: &[Option<String>; 21],
    invalid: &[bool; 21],
) -> Result<(), ImportFileError> {
    for index in 0..HEADERS.len() {
        let value = (!invalid[index])
            .then_some(headers[index].as_deref())
            .flatten();
        validate_header_cell(index, value)?;
    }
    Ok(())
}

fn finish_row(
    active: &mut Option<RowAccumulator>,
    rows: &mut Vec<ImportSourceRow>,
    issues: &mut Vec<ImportCellIssue>,
) -> Result<(), ImportFileError> {
    let Some(row) = active.take() else {
        return Ok(());
    };
    issues.extend(row.issues);
    rows.push(ImportSourceRow {
        source_row: row.row_index + 1,
        format: ImportFileFormat::Xlsx,
        cells: ImportSourceCells::from_columns(row.columns),
    });
    if rows.len() > MAX_DATA_ROWS {
        return Err(ImportFileError::new(
            "ROW_LIMIT_EXCEEDED",
            "가져올 계약 행은 5,000개 이하여야 합니다.",
        ));
    }
    Ok(())
}

fn is_blank(value: &DataRef<'_>) -> bool {
    match value {
        DataRef::Empty => true,
        DataRef::String(value) => value.is_empty(),
        DataRef::SharedString(value) => value.is_empty(),
        _ => false,
    }
}

fn cell_issue(
    source_row: u32,
    column: usize,
    code: &'static str,
    message: &'static str,
) -> ImportCellIssue {
    ImportCellIssue {
        source_row,
        field: FIELD_KEYS[column],
        code,
        message,
    }
}

fn extra_column_error() -> ImportFileError {
    ImportFileError::new(
        "EXTRA_COLUMN_DATA",
        "A:U 밖의 셀에는 데이터를 둘 수 없습니다.",
    )
}

fn workbook_invalid() -> ImportFileError {
    ImportFileError::new(
        "XLSX_STRUCTURE_INVALID",
        "XLSX workbook 구조를 읽을 수 없습니다.",
    )
}
