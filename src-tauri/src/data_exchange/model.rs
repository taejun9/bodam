use serde::{Deserialize, Serialize};

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase", deny_unknown_fields)]
pub(crate) enum ImportFileFormat {
    Xlsx,
    Csv,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ParsedImportFile {
    pub(crate) basename: String,
    pub(crate) format: ImportFileFormat,
    pub(crate) rows: Vec<ImportSourceRow>,
    pub(crate) issues: Vec<ImportCellIssue>,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportSourceRow {
    pub(crate) source_row: u32,
    pub(crate) format: ImportFileFormat,
    pub(crate) cells: ImportSourceCells,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportCellIssue {
    pub(crate) source_row: u32,
    pub(crate) field: &'static str,
    pub(crate) code: &'static str,
    pub(crate) message: &'static str,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportSourceCells {
    pub(crate) no: Option<String>,
    pub(crate) collection_reflected_on: Option<String>,
    pub(crate) affiliation: Option<String>,
    pub(crate) manager: Option<String>,
    pub(crate) collection_code: Option<String>,
    pub(crate) contract: Option<String>,
    pub(crate) insurer: Option<String>,
    pub(crate) product_name: Option<String>,
    pub(crate) policy_number: Option<String>,
    pub(crate) contracted_on: Option<String>,
    pub(crate) status: Option<String>,
    pub(crate) final_payment_month: Option<String>,
    pub(crate) payment_sequence: Option<String>,
    pub(crate) payment_premium: Option<String>,
    pub(crate) contractor: Option<String>,
    pub(crate) insured: Option<String>,
    pub(crate) coverage_starts_on: Option<String>,
    pub(crate) coverage_ends_on: Option<String>,
    pub(crate) collection_method: Option<String>,
    pub(crate) payment_term: Option<String>,
    pub(crate) original_recruiter_name: Option<String>,
}

impl ImportSourceCells {
    pub(crate) fn from_columns(columns: [Option<String>; 21]) -> Self {
        let [no, collection_reflected_on, affiliation, manager, collection_code, contract, insurer, product_name, policy_number, contracted_on, status, final_payment_month, payment_sequence, payment_premium, contractor, insured, coverage_starts_on, coverage_ends_on, collection_method, payment_term, original_recruiter_name] =
            columns;

        Self {
            no,
            collection_reflected_on,
            affiliation,
            manager,
            collection_code,
            contract,
            insurer,
            product_name,
            policy_number,
            contracted_on,
            status,
            final_payment_month,
            payment_sequence,
            payment_premium,
            contractor,
            insured,
            coverage_starts_on,
            coverage_ends_on,
            collection_method,
            payment_term,
            original_recruiter_name,
        }
    }
}
