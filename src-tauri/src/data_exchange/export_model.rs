use serde::{Deserialize, Serialize};

use super::model::ImportSourceCells;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum ContractExportFormat {
    Xlsx,
    Csv,
}

impl ContractExportFormat {
    pub(crate) const fn extension(self) -> &'static str {
        match self {
            Self::Xlsx => "xlsx",
            Self::Csv => "csv",
        }
    }
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContractExportSummary {
    pub(crate) exportable_count: u32,
    pub(crate) missing_source_count: u32,
    pub(crate) conflict_count: u32,
    pub(crate) csv_allowed: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContractExportResult {
    pub(crate) basename: String,
    pub(crate) format: ContractExportFormat,
    pub(crate) exported_count: u32,
    pub(crate) missing_source_count: u32,
    pub(crate) conflict_count: u32,
}

#[derive(Clone, Debug, Eq, PartialEq)]
pub(super) struct ContractExportRow {
    pub(super) cells: ImportSourceCells,
}

#[derive(Debug, Eq, PartialEq)]
pub(super) struct ContractExportSnapshot {
    pub(super) rows: Vec<ContractExportRow>,
    pub(super) exportable_count: u32,
    pub(super) missing_source_count: u32,
    pub(super) conflict_count: u32,
    pub(super) csv_allowed: bool,
    pub(super) generation_limit_exceeded: bool,
}

#[cfg(test)]
mod tests {
    use super::{ContractExportFormat, ContractExportResult, ContractExportSummary};

    #[test]
    fn format_accepts_only_lowercase_ipc_values() {
        assert_eq!(
            serde_json::from_str::<ContractExportFormat>("\"xlsx\"").unwrap(),
            ContractExportFormat::Xlsx
        );
        assert_eq!(
            serde_json::from_str::<ContractExportFormat>("\"csv\"").unwrap(),
            ContractExportFormat::Csv
        );
        for rejected in ["\"XLSX\"", "\"xls\"", "{}", "null"] {
            assert!(serde_json::from_str::<ContractExportFormat>(rejected).is_err());
        }
    }

    #[test]
    fn summary_uses_exact_camel_case_contract() {
        let summary = ContractExportSummary {
            exportable_count: 2,
            missing_source_count: 3,
            conflict_count: 4,
            csv_allowed: false,
        };
        assert_eq!(
            serde_json::to_value(summary).unwrap(),
            serde_json::json!({
                "exportableCount": 2,
                "missingSourceCount": 3,
                "conflictCount": 4,
                "csvAllowed": false
            })
        );
    }

    #[test]
    fn result_contains_only_the_safe_exact_ipc_fields() {
        let result = ContractExportResult {
            basename: "BODAM-contracts-20260807-120000.xlsx".to_owned(),
            format: ContractExportFormat::Xlsx,
            exported_count: 2,
            missing_source_count: 1,
            conflict_count: 3,
        };
        assert_eq!(
            serde_json::to_value(result).unwrap(),
            serde_json::json!({
                "basename": "BODAM-contracts-20260807-120000.xlsx",
                "format": "xlsx",
                "exportedCount": 2,
                "missingSourceCount": 1,
                "conflictCount": 3
            })
        );
    }
}
