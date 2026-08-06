use serde::{Deserialize, Serialize};

use super::model::{ImportFileFormat, ImportSourceRow};

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct MappedContractPolicy {
    pub insurer: String,
    pub product_name: String,
    pub joined_on: Option<String>,
    pub status: Option<String>,
    pub monthly_premium_won: String,
    pub matures_on: Option<String>,
    pub payment_term: Option<String>,
    pub coverage_term: Option<String>,
    pub disclosure_plan: Option<String>,
    pub renewable: bool,
    pub is_included: bool,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(
    tag = "kind",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum ImportCustomerReference {
    Existing { customer_id: String },
    New { client_key: String },
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(
    tag = "action",
    rename_all = "camelCase",
    rename_all_fields = "camelCase",
    deny_unknown_fields
)]
pub(crate) enum ImportRowDecision {
    Create { customer: ImportCustomerReference },
    SeparateCreate { customer: ImportCustomerReference },
    Update { target_policy_id: String },
    Skip,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct NewImportCustomer {
    pub client_key: String,
    pub name: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportCommitSummary {
    pub total_rows: u32,
    pub invalid_rows: u32,
    pub unselected_rows: u32,
}

#[derive(Clone, Debug, Eq, PartialEq, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ImportCommitRequestRow {
    pub source: ImportSourceRow,
    pub mapped: MappedContractPolicy,
    pub decision: ImportRowDecision,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportCommitRequest {
    pub preview_id: String,
    pub snapshot_token: String,
    pub format: ImportFileFormat,
    pub new_customers: Vec<NewImportCustomer>,
    pub rows: Vec<ImportCommitRequestRow>,
    pub summary: ImportCommitSummary,
}

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum ImportCommitOutcomeKind {
    Created,
    Updated,
    Skipped,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportCommitOutcome {
    pub source_row: u32,
    pub outcome: ImportCommitOutcomeKind,
    pub policy_id: Option<String>,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportCommitResult {
    pub created: u32,
    pub updated: u32,
    pub skipped: u32,
    pub total_rows: u32,
    pub invalid_rows: u32,
    pub unselected_rows: u32,
    pub outcomes: Vec<ImportCommitOutcome>,
}

#[cfg(test)]
mod tests {
    use super::{ImportCustomerReference, ImportRowDecision};

    #[test]
    fn deserializes_camel_case_fields_inside_tagged_decisions() {
        let create: ImportRowDecision = serde_json::from_value(serde_json::json!({
            "action": "create",
            "customer": { "kind": "new", "clientKey": "synthetic-client" }
        }))
        .unwrap();
        assert_eq!(
            create,
            ImportRowDecision::Create {
                customer: ImportCustomerReference::New {
                    client_key: "synthetic-client".to_owned(),
                },
            }
        );

        let update: ImportRowDecision = serde_json::from_value(serde_json::json!({
            "action": "update",
            "targetPolicyId": "00000000-0000-4000-8000-000000000001"
        }))
        .unwrap();
        assert!(matches!(update, ImportRowDecision::Update { .. }));
    }

    #[test]
    fn rejects_snake_case_fields_at_the_ipc_boundary() {
        let error = serde_json::from_value::<ImportCustomerReference>(serde_json::json!({
            "kind": "existing",
            "customer_id": "00000000-0000-4000-8000-000000000001"
        }));
        assert!(error.is_err());
    }
}
