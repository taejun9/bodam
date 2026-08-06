use super::export_model::ContractExportRow;
use super::model::ImportSourceCells;

pub(super) fn export_row(policy_id: &str, contracted_on: Option<&str>) -> ContractExportRow {
    let mut columns: [Option<String>; 21] = std::array::from_fn(|_| None);
    columns[0] = Some("0001".to_owned());
    columns[6] = Some("합성보험".to_owned());
    columns[7] = Some("합성상품".to_owned());
    columns[8] = Some(format!("SYNTHETIC-{policy_id}"));
    columns[9] = contracted_on.map(str::to_owned);
    columns[13] = Some("001000".to_owned());
    ContractExportRow {
        cells: ImportSourceCells::from_columns(columns),
    }
}
