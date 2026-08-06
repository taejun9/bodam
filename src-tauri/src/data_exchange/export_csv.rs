use csv::{Terminator, WriterBuilder};

use crate::text::trim_ecmascript_whitespace;

use super::constants::{HEADERS, MAX_FILE_BYTES};
use super::export_error::ContractExportError;
use super::export_model::{ContractExportFormat, ContractExportRow};
use super::export_verify::verify_generated_cells;
use super::model::ImportSourceCells;

const UTF8_BOM: &[u8] = b"\xEF\xBB\xBF";

pub(super) fn csv_allowed(rows: &[ContractExportRow]) -> bool {
    rows.iter().all(|row| cells_csv_allowed(&row.cells))
}

pub(super) fn cells_csv_allowed(cells: &ImportSourceCells) -> bool {
    !cells
        .values()
        .into_iter()
        .flatten()
        .any(has_formula_trigger)
}

pub(super) fn build_csv(rows: &[ContractExportRow]) -> Result<Vec<u8>, ContractExportError> {
    if !csv_allowed(rows) {
        return Err(ContractExportError::new(
            "CSV_FORMULA_RISK",
            "CSV 수식 실행 위험이 있어 저장을 중단했습니다. XLSX를 사용해 주세요.",
        ));
    }
    let mut writer = WriterBuilder::new()
        .terminator(Terminator::CRLF)
        .from_writer(Vec::new());
    writer
        .write_record(HEADERS)
        .map_err(|_| ContractExportError::generation_failed())?;
    for row in rows {
        writer
            .write_record(row.cells.values().map(Option::unwrap_or_default))
            .map_err(|_| ContractExportError::generation_failed())?;
    }
    let payload = writer
        .into_inner()
        .map_err(|_| ContractExportError::generation_failed())?;
    let mut bytes = Vec::with_capacity(UTF8_BOM.len() + payload.len());
    bytes.extend_from_slice(UTF8_BOM);
    bytes.extend_from_slice(&payload);
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(ContractExportError::file_too_large());
    }
    verify_generated_cells(ContractExportFormat::Csv, rows, &bytes)?;
    Ok(bytes)
}

fn has_formula_trigger(value: &str) -> bool {
    let raw_leading = value.chars().next();
    let trimmed_leading = trim_ecmascript_whitespace(value).chars().next();
    raw_leading.is_some_and(is_trigger)
        || trimmed_leading.is_some_and(|character| matches!(character, '=' | '+' | '-' | '@'))
}

fn is_trigger(character: char) -> bool {
    matches!(character, '=' | '+' | '-' | '@' | '\t' | '\r')
}

#[cfg(test)]
mod tests {
    use super::{build_csv, has_formula_trigger, UTF8_BOM};
    use crate::data_exchange::export_test_support::export_row;

    #[test]
    fn rejects_raw_and_ecmascript_trimmed_formula_triggers() {
        for value in [
            "=1+1",
            "+cmd",
            "-2",
            "@sum",
            "\tplain",
            "\rplain",
            "\n=hidden",
            " \t =1",
            "\u{feff}@call",
        ] {
            assert!(has_formula_trigger(value), "missed trigger category");
        }
        for value in ["", "plain", "\nplain", " 123", "\u{0085}=not-trimmed"] {
            assert!(!has_formula_trigger(value), "rejected safe category");
        }
    }

    #[test]
    fn writes_bom_crlf_quotes_nul_and_exact_twenty_one_fields() {
        let mut row = export_row("csv", Some("2026-08-07"));
        row.cells.affiliation = Some("쉼표, 따옴표 \" 와\r\n줄바꿈".to_owned());
        row.cells.insured = Some("NUL\0보존".to_owned());

        let bytes = build_csv(&[row]).unwrap();
        assert!(bytes.starts_with(UTF8_BOM));
        assert!(bytes.ends_with(b"\r\n"));
        let text = std::str::from_utf8(&bytes[UTF8_BOM.len()..]).unwrap();
        assert!(text.contains("\"쉼표, 따옴표 \"\" 와\r\n줄바꿈\""));
        assert!(text.contains("NUL\0보존"));
        assert_eq!(text.matches("\r\n").count(), 3);
    }

    #[test]
    fn rejects_the_whole_csv_without_echoing_a_dangerous_value() {
        let mut row = export_row("risk", None);
        row.cells.manager = Some("  =PRIVATE-SYNTHETIC-VALUE".to_owned());

        let error = build_csv(&[row]).unwrap_err();
        assert_eq!(error.code, "CSV_FORMULA_RISK");
        let serialized = serde_json::to_string(&error).unwrap();
        assert!(!serialized.contains("PRIVATE-SYNTHETIC-VALUE"));
    }

    #[test]
    fn accepts_five_thousand_rows_and_enforces_the_byte_cap() {
        let compact = export_row("limit", None);
        assert!(build_csv(&vec![compact; 5_000]).is_ok());

        let mut large = export_row("large", None);
        large.cells.affiliation = Some("A".repeat(4_000));
        let error = build_csv(&vec![large; 2_700]).unwrap_err();
        assert_eq!(error.code, "EXPORT_FILE_TOO_LARGE");
    }
}
