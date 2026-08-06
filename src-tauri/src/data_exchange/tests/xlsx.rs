use super::helpers::{valid_xlsx, xlsx_bytes};
use crate::data_exchange::constants::{
    HEADERS, MAX_ARCHIVE_ENTRY_BYTES, MAX_ARCHIVE_TOTAL_BYTES, TARGET_SHEET,
};
use crate::data_exchange::model::ImportFileFormat;
use crate::data_exchange::parser::parse_import_bytes;
use rust_xlsxwriter::Workbook;
use std::io::{Cursor, Read};
use unicode_normalization::UnicodeNormalization;
use zip::ZipArchive;

#[test]
fn parses_xlsx_text_null_and_source_rows() {
    let bytes = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "0007").unwrap();
        sheet.write_string(1, 8, "P-001").unwrap();
        sheet.write_string(3, 0, " 2 ").unwrap();
    });
    let parsed = parse_import_bytes("계약조회.xlsx", &bytes).unwrap();

    assert_eq!(parsed.format, ImportFileFormat::Xlsx);
    assert_eq!(parsed.rows.len(), 2);
    assert_eq!(parsed.rows[0].source_row, 2);
    assert_eq!(parsed.rows[1].source_row, 4);
    assert_eq!(parsed.rows[0].cells.no.as_deref(), Some("0007"));
    assert_eq!(parsed.rows[0].cells.policy_number.as_deref(), Some("P-001"));
    assert_eq!(parsed.rows[0].cells.contractor, None);
    assert_eq!(parsed.rows[1].cells.no.as_deref(), Some(" 2 "));
}

#[test]
fn accepts_nfd_sheet_and_headers() {
    let sheet_name = TARGET_SHEET.nfd().collect::<String>();
    let headers = HEADERS
        .iter()
        .map(|header| header.nfd().collect::<String>())
        .collect::<Vec<_>>();
    let bytes = xlsx_bytes(&sheet_name, &headers, |sheet| {
        sheet.write_string(1, 0, "1").unwrap();
    });
    assert!(parse_import_bytes("nfd.xlsx", &bytes).is_ok());
}

#[test]
fn allows_unrelated_workbook_sheets() {
    let mut workbook = Workbook::new();
    workbook
        .add_worksheet()
        .set_name("안내")
        .unwrap()
        .write_string(0, 0, "ignored")
        .unwrap();
    let target = workbook.add_worksheet();
    target.set_name(TARGET_SHEET).unwrap();
    for (column, header) in HEADERS.iter().enumerate() {
        target.write_string(0, column as u16, *header).unwrap();
    }
    target.write_string(1, 0, "1").unwrap();
    let bytes = workbook.save_to_buffer().unwrap();
    assert!(parse_import_bytes("extra-sheet.xlsx", &bytes).is_ok());
}

#[test]
fn reports_formula_and_non_text_cells_without_values() {
    let bytes = valid_xlsx(|sheet| {
        sheet.write_formula(1, 0, "=1+1").unwrap();
        sheet.write_number(1, 1, 42).unwrap();
        sheet.write_string(1, 2, "safe").unwrap();
    });
    let parsed = parse_import_bytes("issues.xlsx", &bytes).unwrap();

    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].cells.no, None);
    assert_eq!(parsed.rows[0].cells.collection_reflected_on, None);
    assert_eq!(parsed.issues.len(), 2);
    assert_eq!(parsed.issues[0].code, "FORMULA_CELL");
    assert_eq!(parsed.issues[0].field, "no");
    assert_eq!(parsed.issues[1].code, "NON_TEXT_CELL");
    assert_eq!(parsed.issues[1].field, "collectionReflectedOn");
}

#[test]
fn rejects_missing_duplicate_and_wrong_target_sheet() {
    let headers = HEADERS
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    let wrong = xlsx_bytes("다른 sheet", &headers, |_| {});
    assert_code(&wrong, "TARGET_SHEET_MISSING");

    let mut workbook = Workbook::new();
    for name in [TARGET_SHEET.to_owned(), TARGET_SHEET.nfd().collect()] {
        let sheet = workbook.add_worksheet();
        sheet.set_name(name).unwrap();
    }
    let duplicate = workbook.save_to_buffer().unwrap();
    assert_code(&duplicate, "TARGET_SHEET_DUPLICATE");
}

#[test]
fn rejects_wrong_header_and_extra_column_data() {
    let mut headers = HEADERS
        .iter()
        .map(|value| value.to_string())
        .collect::<Vec<_>>();
    headers.swap(0, 1);
    let wrong_header = xlsx_bytes(TARGET_SHEET, &headers, |_| {});
    assert_code(&wrong_header, "HEADER_INVALID");

    let extra = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "1").unwrap();
        sheet.write_string(1, 21, "outside").unwrap();
    });
    assert_code(&extra, "EXTRA_COLUMN_DATA");
}

#[test]
fn enforces_xlsx_cell_and_row_limits() {
    let long = valid_xlsx(|sheet| {
        sheet.write_string(1, 0, "가".repeat(4_001)).unwrap();
    });
    assert_code(&long, "CELL_TOO_LONG");

    let too_many = valid_xlsx(|sheet| {
        for row in 1..=5_001 {
            sheet.write_string(row, 0, "1").unwrap();
        }
    });
    assert_code(&too_many, "ROW_LIMIT_EXCEEDED");
}

#[test]
fn rejects_repeated_shared_text_before_copying_past_logical_budget() {
    let repeated = "🧪".repeat(1_000);
    let bytes = valid_xlsx(|sheet| {
        for row in 1..=250 {
            for column in 0..HEADERS.len() {
                sheet
                    .write_string(row, column as u16, repeated.as_str())
                    .unwrap();
            }
        }
    });
    assert!(bytes.len() < 10 * 1024 * 1024);
    let mut archive = ZipArchive::new(Cursor::new(bytes.as_slice())).unwrap();
    let mut uncompressed_total = 0_u64;
    let mut shared_reference_count = 0_usize;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).unwrap();
        assert!(file.size() <= MAX_ARCHIVE_ENTRY_BYTES);
        uncompressed_total += file.size();
        if file.name() == "xl/worksheets/sheet1.xml" {
            let mut xml = String::new();
            file.read_to_string(&mut xml).unwrap();
            shared_reference_count = xml.matches(" t=\"s\"").count();
        }
    }
    assert!(uncompressed_total <= MAX_ARCHIVE_TOTAL_BYTES);
    assert!(shared_reference_count >= 250 * HEADERS.len());

    assert_code(&bytes, "XLSX_LOGICAL_TEXT_LIMIT");
}

#[test]
fn rejects_xlsx_without_data_rows() {
    assert_code(&valid_xlsx(|_| {}), "NO_DATA_ROWS");
}

fn assert_code(bytes: &[u8], expected: &str) {
    let error = parse_import_bytes("test.xlsx", bytes).unwrap_err();
    assert_eq!(error.code, expected);
}
