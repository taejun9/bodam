use super::export_error::ContractExportError;
use super::export_model::{ContractExportFormat, ContractExportRow};
use super::model::ImportFileFormat;
use super::parser::parse_import_bytes;

pub(super) fn verify_generated_cells(
    format: ContractExportFormat,
    rows: &[ContractExportRow],
    bytes: &[u8],
) -> Result<(), ContractExportError> {
    let basename = format!("BODAM-contracts.{}", format.extension());
    let parsed = parse_import_bytes(&basename, bytes)
        .map_err(|_| ContractExportError::verification_failed())?;
    let expected_format = match format {
        ContractExportFormat::Xlsx => ImportFileFormat::Xlsx,
        ContractExportFormat::Csv => ImportFileFormat::Csv,
    };
    let matches = parsed.format == expected_format
        && parsed.issues.is_empty()
        && parsed.rows.len() == rows.len()
        && parsed
            .rows
            .iter()
            .zip(rows)
            .all(|(actual, expected)| actual.cells == expected.cells);
    matches
        .then_some(())
        .ok_or_else(ContractExportError::verification_failed)
}
