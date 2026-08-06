use super::constants::{HEADERS, MAX_DATA_ROWS};
use super::error::ImportFileError;
use super::model::{ImportFileFormat, ImportSourceCells, ImportSourceRow, ParsedImportFile};
use super::parser::{validate_cell_length, validate_header_cell};
use csv::{ReaderBuilder, StringRecord, Terminator};

const UTF8_BOM: &[u8] = b"\xEF\xBB\xBF";

pub(crate) fn parse_csv(
    basename: String,
    bytes: &[u8],
) -> Result<ParsedImportFile, ImportFileError> {
    let payload = validate_envelope(bytes)?;
    let text = std::str::from_utf8(payload).map_err(|_| {
        ImportFileError::new("CSV_UTF8_INVALID", "CSV는 올바른 UTF-8이어야 합니다.")
    })?;
    let mut reader = ReaderBuilder::new()
        .has_headers(false)
        .flexible(true)
        .terminator(Terminator::CRLF)
        .from_reader(text.as_bytes());
    let mut records = reader.records();

    let header = next_record(&mut records)?
        .ok_or_else(|| ImportFileError::new("HEADER_INVALID", "CSV 헤더를 찾을 수 없습니다."))?;
    if header.len() != HEADERS.len() {
        return Err(field_count_error(1));
    }
    for index in 0..HEADERS.len() {
        validate_header_cell(index, header.get(index))?;
    }

    let mut rows = Vec::new();
    for (record_index, result) in records.enumerate() {
        let record = result.map_err(|_| {
            ImportFileError::new("CSV_RECORD_INVALID", "CSV 행 구조를 읽을 수 없습니다.")
        })?;
        let source_row = record_index as u32 + 2;
        if record.len() != HEADERS.len() {
            return Err(field_count_error(source_row));
        }
        if is_blank_record(&record) {
            continue;
        }

        let mut columns: [Option<String>; 21] = std::array::from_fn(|_| None);
        for (index, column) in columns.iter_mut().enumerate() {
            let value = record.get(index).unwrap_or_default();
            validate_cell_length(value, source_row, index)?;
            if !value.is_empty() {
                *column = Some(value.to_owned());
            }
        }
        rows.push(ImportSourceRow {
            source_row,
            format: ImportFileFormat::Csv,
            cells: ImportSourceCells::from_columns(columns),
        });
        if rows.len() > MAX_DATA_ROWS {
            return Err(row_limit_error());
        }
    }

    if rows.is_empty() {
        return Err(ImportFileError::new(
            "NO_DATA_ROWS",
            "가져올 계약 행이 없습니다.",
        ));
    }
    Ok(ParsedImportFile {
        basename,
        format: ImportFileFormat::Csv,
        rows,
        issues: Vec::new(),
    })
}

fn validate_envelope(bytes: &[u8]) -> Result<&[u8], ImportFileError> {
    let payload = bytes.strip_prefix(UTF8_BOM).ok_or_else(|| {
        ImportFileError::new("CSV_BOM_REQUIRED", "CSV에는 UTF-8 BOM이 필요합니다.")
    })?;
    if payload.starts_with(UTF8_BOM) {
        return Err(ImportFileError::new(
            "CSV_BOM_DUPLICATE",
            "CSV의 UTF-8 BOM은 한 번만 있어야 합니다.",
        ));
    }
    if payload.is_empty() || !payload.ends_with(b"\r\n") {
        return Err(line_ending_error());
    }
    validate_record_syntax(payload)?;
    Ok(payload)
}

fn validate_record_syntax(payload: &[u8]) -> Result<(), ImportFileError> {
    #[derive(Clone, Copy)]
    enum State {
        FieldStart,
        Unquoted,
        Quoted,
        QuoteClosed,
    }

    let mut state = State::FieldStart;
    let mut index = 0;
    while index < payload.len() {
        let byte = payload[index];
        state = match (state, byte) {
            (State::FieldStart, b'"') => State::Quoted,
            (State::FieldStart, b',') => State::FieldStart,
            (State::FieldStart, b'\r') if payload.get(index + 1) == Some(&b'\n') => {
                index += 1;
                State::FieldStart
            }
            (State::FieldStart, b'\r' | b'\n') => return Err(line_ending_error()),
            (State::FieldStart, _) => State::Unquoted,
            (State::Unquoted, b'"') => return Err(record_syntax_error()),
            (State::Unquoted, b',') => State::FieldStart,
            (State::Unquoted, b'\r') if payload.get(index + 1) == Some(&b'\n') => {
                index += 1;
                State::FieldStart
            }
            (State::Unquoted, b'\r' | b'\n') => return Err(line_ending_error()),
            (State::Unquoted, _) => State::Unquoted,
            (State::Quoted, b'"') => State::QuoteClosed,
            (State::Quoted, _) => State::Quoted,
            (State::QuoteClosed, b'"') => State::Quoted,
            (State::QuoteClosed, b',') => State::FieldStart,
            (State::QuoteClosed, b'\r') if payload.get(index + 1) == Some(&b'\n') => {
                index += 1;
                State::FieldStart
            }
            (State::QuoteClosed, b'\r' | b'\n') => return Err(line_ending_error()),
            (State::QuoteClosed, _) => return Err(record_syntax_error()),
        };
        index += 1;
    }
    if matches!(state, State::FieldStart) {
        Ok(())
    } else {
        Err(record_syntax_error())
    }
}

fn next_record<I>(records: &mut I) -> Result<Option<StringRecord>, ImportFileError>
where
    I: Iterator<Item = csv::Result<StringRecord>>,
{
    records
        .next()
        .transpose()
        .map_err(|_| ImportFileError::new("CSV_RECORD_INVALID", "CSV 행 구조를 읽을 수 없습니다."))
}

fn is_blank_record(record: &StringRecord) -> bool {
    record.iter().all(str::is_empty)
}

fn field_count_error(source_row: u32) -> ImportFileError {
    ImportFileError::at_row(
        "CSV_FIELD_COUNT_INVALID",
        "CSV의 모든 행은 정확히 21개 필드여야 합니다.",
        source_row,
    )
}

fn line_ending_error() -> ImportFileError {
    ImportFileError::new(
        "CSV_LINE_ENDING_INVALID",
        "CSV 줄바꿈은 CRLF 형식이어야 합니다.",
    )
}

fn record_syntax_error() -> ImportFileError {
    ImportFileError::new("CSV_RECORD_INVALID", "CSV 행 구조를 읽을 수 없습니다.")
}

fn row_limit_error() -> ImportFileError {
    ImportFileError::new(
        "ROW_LIMIT_EXCEEDED",
        "가져올 계약 행은 5,000개 이하여야 합니다.",
    )
}
