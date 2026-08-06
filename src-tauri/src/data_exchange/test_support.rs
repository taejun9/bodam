use super::commit_model::{
    ImportCommitRequest, ImportCommitRequestRow, ImportCommitSummary, ImportRowDecision,
    MappedContractPolicy, NewImportCustomer,
};
use super::context::{ImportContextQuery, ImportContextSnapshot, ImportDuplicateKey};
use super::model::{ImportFileFormat, ImportSourceCells, ImportSourceRow};
use super::repository::DataExchangeRepository;
use crate::text::trim_ecmascript_whitespace;
use unicode_normalization::UnicodeNormalization;

pub(super) const CUSTOMER_A: &str = "70000000-0000-4000-8000-000000000001";
pub(super) const CUSTOMER_B: &str = "70000000-0000-4000-8000-000000000002";
pub(super) const MISSING_CUSTOMER: &str = "70000000-0000-4000-8000-000000000099";

pub(super) fn cells(
    tag: &str,
    insurer: &str,
    product: &str,
    policy_number: &str,
    premium: &str,
) -> ImportSourceCells {
    ImportSourceCells {
        no: Some(format!("번호-{tag}")),
        collection_reflected_on: Some("2026-08-01".to_owned()),
        affiliation: Some(format!("소속-{tag}")),
        manager: Some(format!("담당-{tag}")),
        collection_code: Some(format!("코드-{tag}")),
        contract: Some(format!("계약-{tag}")),
        insurer: Some(format!(" {insurer} ")),
        product_name: Some(format!(" {product} ")),
        policy_number: Some(format!(" {policy_number} ")),
        contracted_on: Some("2026-01-02".to_owned()),
        status: Some(format!(" 상태-{tag} ")),
        final_payment_month: Some("204512".to_owned()),
        payment_sequence: Some("0007".to_owned()),
        payment_premium: Some(premium.to_owned()),
        contractor: Some(format!("계약자-{tag}")),
        insured: Some(format!("피보험자-{tag}")),
        coverage_starts_on: Some("2026-02-03".to_owned()),
        coverage_ends_on: Some("2045-12-31".to_owned()),
        collection_method: Some(format!("납입-{tag}")),
        payment_term: Some(" 20년 ".to_owned()),
        original_recruiter_name: Some(format!("모집자-{tag}")),
    }
}

pub(super) fn row(
    source_row: u32,
    cells: ImportSourceCells,
    decision: ImportRowDecision,
) -> ImportCommitRequestRow {
    let mapped = mapped(&cells);
    ImportCommitRequestRow {
        source: ImportSourceRow {
            source_row,
            format: ImportFileFormat::Csv,
            cells,
        },
        mapped,
        decision,
    }
}

pub(super) fn request(
    snapshot_token: &str,
    rows: Vec<ImportCommitRequestRow>,
    new_customers: Vec<NewImportCustomer>,
) -> ImportCommitRequest {
    ImportCommitRequest {
        preview_id: "preview-synthetic".to_owned(),
        snapshot_token: snapshot_token.to_owned(),
        format: ImportFileFormat::Csv,
        new_customers,
        summary: ImportCommitSummary {
            total_rows: rows.len() as u32,
            invalid_rows: 0,
            unselected_rows: 0,
        },
        rows,
    }
}

pub(super) fn context(
    repository: &DataExchangeRepository,
    keys: &[(&str, &str)],
) -> ImportContextSnapshot {
    repository
        .context(ImportContextQuery {
            keys: keys
                .iter()
                .map(|(insurer, policy_number)| ImportDuplicateKey {
                    insurer: (*insurer).to_owned(),
                    policy_number: (*policy_number).to_owned(),
                })
                .collect(),
        })
        .unwrap()
}

pub(super) fn source_values(cells: &ImportSourceCells) -> Vec<Option<String>> {
    vec![
        cells.no.clone(),
        cells.collection_reflected_on.clone(),
        cells.affiliation.clone(),
        cells.manager.clone(),
        cells.collection_code.clone(),
        cells.contract.clone(),
        cells.insurer.clone(),
        cells.product_name.clone(),
        cells.policy_number.clone(),
        cells.contracted_on.clone(),
        cells.status.clone(),
        cells.final_payment_month.clone(),
        cells.payment_sequence.clone(),
        cells.payment_premium.clone(),
        cells.contractor.clone(),
        cells.insured.clone(),
        cells.coverage_starts_on.clone(),
        cells.coverage_ends_on.clone(),
        cells.collection_method.clone(),
        cells.payment_term.clone(),
        cells.original_recruiter_name.clone(),
    ]
}

fn mapped(cells: &ImportSourceCells) -> MappedContractPolicy {
    let normalize = |value: &Option<String>| {
        value
            .as_deref()
            .map(trim_ecmascript_whitespace)
            .filter(|v| !v.is_empty())
            .map(|value| value.nfc().collect())
    };
    MappedContractPolicy {
        insurer: normalize(&cells.insurer).unwrap(),
        product_name: normalize(&cells.product_name).unwrap(),
        joined_on: normalize(&cells.contracted_on),
        status: normalize(&cells.status),
        monthly_premium_won: normalize(&cells.payment_premium)
            .unwrap()
            .parse::<i64>()
            .unwrap()
            .to_string(),
        matures_on: normalize(&cells.coverage_ends_on),
        payment_term: normalize(&cells.payment_term),
        coverage_term: None,
        disclosure_plan: None,
        renewable: false,
        is_included: true,
    }
}
