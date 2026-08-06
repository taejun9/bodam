use super::helpers::{csv_bytes, row_with};
use crate::data_exchange::constants::HEADERS;
use crate::data_exchange::model::ImportFileFormat;
use crate::data_exchange::parser::parse_import_bytes;
use csv::{Terminator, WriterBuilder};
use unicode_normalization::UnicodeNormalization;

#[test]
fn parses_csv_raw_text_null_and_logical_source_rows() {
    let mut first = row_with("00123");
    first[1] = " 2026-08-06 ".to_owned();
    first[7] = "첫 줄\r\n둘째 줄".to_owned();
    let blank = vec![String::new(); HEADERS.len()];
    let second = row_with("2");
    let parsed = parse_import_bytes("계약조회.CSV", &csv_bytes(&[first, blank, second])).unwrap();

    assert_eq!(parsed.format, ImportFileFormat::Csv);
    assert_eq!(parsed.rows.len(), 2);
    assert_eq!(parsed.rows[0].source_row, 2);
    assert_eq!(parsed.rows[1].source_row, 4);
    assert_eq!(parsed.rows[0].cells.no.as_deref(), Some("00123"));
    assert_eq!(
        parsed.rows[0].cells.collection_reflected_on.as_deref(),
        Some(" 2026-08-06 ")
    );
    assert_eq!(
        parsed.rows[0].cells.product_name.as_deref(),
        Some("첫 줄\r\n둘째 줄")
    );
    assert_eq!(parsed.rows[0].cells.contract, None);
}

#[test]
fn accepts_bare_line_breaks_inside_rfc4180_quoted_fields() {
    let mut row = row_with("1");
    row[5] = "첫 줄\n둘째 줄\r셋째 줄".to_owned();
    let parsed = parse_import_bytes("quoted-newlines.csv", &csv_bytes(&[row])).unwrap();

    assert_eq!(
        parsed.rows[0].cells.contract.as_deref(),
        Some("첫 줄\n둘째 줄\r셋째 줄")
    );
}

#[test]
fn accepts_nfd_header_after_nfc_comparison() {
    let mut writer = WriterBuilder::new()
        .terminator(Terminator::CRLF)
        .from_writer(Vec::new());
    let headers = HEADERS
        .iter()
        .map(|header| header.nfd().collect::<String>())
        .collect::<Vec<_>>();
    writer.write_record(headers).unwrap();
    writer.write_record(row_with("1")).unwrap();
    let mut bytes = b"\xEF\xBB\xBF".to_vec();
    bytes.extend(writer.into_inner().unwrap());
    assert!(parse_import_bytes("nfd.csv", &bytes).is_ok());
}

#[test]
fn rejects_csv_envelope_and_record_violations() {
    let valid = csv_bytes(&[row_with("1")]);
    assert_code(&valid[3..], "CSV_BOM_REQUIRED");

    let mut duplicate = b"\xEF\xBB\xBF".to_vec();
    duplicate.extend(valid);
    assert_code(&duplicate, "CSV_BOM_DUPLICATE");

    let mut lf_only = b"\xEF\xBB\xBF".to_vec();
    lf_only.extend_from_slice(
        format!("{}\n{}\n", HEADERS.join(","), vec![""; 20].join(",")).as_bytes(),
    );
    assert_code(&lf_only, "CSV_LINE_ENDING_INVALID");

    let invalid_utf8 = b"\xEF\xBB\xBF\xFF\r\n";
    assert_code(invalid_utf8, "CSV_UTF8_INVALID");

    let malformed = b"\xEF\xBB\xBF\"No\"x,\r\n";
    assert_code(malformed, "CSV_RECORD_INVALID");

    let mut lone_cr = b"\xEF\xBB\xBF".to_vec();
    lone_cr.extend_from_slice(
        format!("{}\r{}\r\n", HEADERS.join(","), row_with("1").join(",")).as_bytes(),
    );
    assert_code(&lone_cr, "CSV_LINE_ENDING_INVALID");
}

#[test]
fn rejects_wrong_field_count_and_header() {
    let short_row = vec!["1".to_owned(); 20];
    assert_code(&csv_bytes(&[short_row]), "CSV_FIELD_COUNT_INVALID");

    let mut bytes = csv_bytes(&[row_with("1")]);
    let header_offset = 3;
    bytes[header_offset] = b'X';
    assert_code(&bytes, "HEADER_INVALID");
}

#[test]
fn validates_field_count_before_skipping_blank_records() {
    for field_count in [3, 22] {
        let blank = vec![String::new(); field_count];
        assert_code(&csv_bytes(&[blank]), "CSV_FIELD_COUNT_INVALID");
    }

    let blank = vec![String::new(); HEADERS.len()];
    let parsed = parse_import_bytes("blank.csv", &csv_bytes(&[blank, row_with("1")])).unwrap();
    assert_eq!(parsed.rows.len(), 1);
    assert_eq!(parsed.rows[0].source_row, 3);
}

#[test]
fn enforces_csv_cell_and_row_limits() {
    let long = row_with(&"가".repeat(4_001));
    assert_code(&csv_bytes(&[long]), "CELL_TOO_LONG");

    let rows = (0..5_001).map(|_| row_with("1")).collect::<Vec<_>>();
    assert_code(&csv_bytes(&rows), "ROW_LIMIT_EXCEEDED");
}

#[test]
fn rejects_csv_without_data_rows() {
    assert_code(&csv_bytes(&[]), "NO_DATA_ROWS");
}

fn assert_code(bytes: &[u8], expected: &str) {
    let error = parse_import_bytes("test.csv", bytes).unwrap_err();
    assert_eq!(error.code, expected);
}
