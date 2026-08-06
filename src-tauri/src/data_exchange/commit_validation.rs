use std::collections::{BTreeMap, BTreeSet};

use chrono::NaiveDate;
use unicode_normalization::UnicodeNormalization;
use uuid::Uuid;

use crate::error::AppError;
use crate::text::trim_ecmascript_whitespace;

use super::commit_model::{
    ImportCommitRequest, ImportCustomerReference, ImportRowDecision, MappedContractPolicy,
};
use super::constants::MAX_DATA_ROWS;
use super::model::ImportSourceCells;

const MAX_SOURCE_ROW: u32 = i32::MAX as u32;

pub(crate) fn validate_commit_request(
    mut request: ImportCommitRequest,
) -> Result<ImportCommitRequest, AppError> {
    if request.preview_id.is_empty()
        || request.preview_id.chars().count() > 200
        || request.snapshot_token.len() != 64
        || !request
            .snapshot_token
            .bytes()
            .all(|byte| byte.is_ascii_hexdigit())
        || request.rows.is_empty()
        || request.rows.len() > MAX_DATA_ROWS
        || request.new_customers.len() > MAX_DATA_ROWS
        || request.summary.invalid_rows > MAX_DATA_ROWS as u32
        || request.summary.unselected_rows > MAX_DATA_ROWS as u32
        || request.summary.total_rows > MAX_DATA_ROWS as u32
    {
        return Err(invalid_request());
    }
    let expected_total = (request.rows.len() as u32)
        .checked_add(request.summary.invalid_rows)
        .and_then(|total| total.checked_add(request.summary.unselected_rows))
        .ok_or_else(invalid_request)?;
    if request.summary.total_rows != expected_total {
        return Err(invalid_request());
    }

    let mut definitions = BTreeMap::new();
    for customer in &mut request.new_customers {
        validate_client_key(&customer.client_key)?;
        customer.name = normalize(&customer.name);
        if customer.name.is_empty()
            || customer.name.chars().count() > 4_000
            || definitions
                .insert(customer.client_key.clone(), customer.name.clone())
                .is_some()
        {
            return Err(invalid_request());
        }
    }

    let mut previous_row = 1_u32;
    let mut used_new_customers = BTreeSet::new();
    let mut update_targets = BTreeSet::new();
    let mut has_write = false;
    for row in &request.rows {
        if row.source.source_row <= previous_row
            || row.source.source_row > MAX_SOURCE_ROW
            || row.source.format != request.format
        {
            return Err(invalid_request());
        }
        previous_row = row.source.source_row;
        validate_source_cells(&row.source.cells)?;
        if map_source(&row.source.cells)? != row.mapped {
            return Err(invalid_request());
        }
        match &row.decision {
            ImportRowDecision::Create { customer }
            | ImportRowDecision::SeparateCreate { customer } => {
                has_write = true;
                validate_customer_reference(customer, &definitions, &mut used_new_customers)?;
            }
            ImportRowDecision::Update { target_policy_id } => {
                has_write = true;
                validate_uuid(target_policy_id)?;
                if !update_targets.insert(target_policy_id.clone()) {
                    return Err(invalid_request());
                }
            }
            ImportRowDecision::Skip => {}
        }
    }
    if !has_write || used_new_customers != definitions.keys().cloned().collect::<BTreeSet<_>>() {
        return Err(invalid_request());
    }
    Ok(request)
}

fn validate_customer_reference(
    reference: &ImportCustomerReference,
    definitions: &BTreeMap<String, String>,
    used: &mut BTreeSet<String>,
) -> Result<(), AppError> {
    match reference {
        ImportCustomerReference::Existing { customer_id } => validate_uuid(customer_id),
        ImportCustomerReference::New { client_key } => {
            validate_client_key(client_key)?;
            if !definitions.contains_key(client_key) {
                return Err(invalid_request());
            }
            used.insert(client_key.clone());
            Ok(())
        }
    }
}

fn validate_source_cells(cells: &ImportSourceCells) -> Result<(), AppError> {
    for value in source_values(cells).into_iter().flatten() {
        if value.chars().count() > 4_000 {
            return Err(invalid_request());
        }
    }
    for value in [
        &cells.collection_reflected_on,
        &cells.contracted_on,
        &cells.coverage_starts_on,
        &cells.coverage_ends_on,
    ] {
        if normalize_optional(value.as_deref()).is_some_and(|value| !is_date_only(&value)) {
            return Err(invalid_request());
        }
    }
    if normalize_optional(cells.final_payment_month.as_deref())
        .is_some_and(|value| !is_year_month(&value))
        || normalize_optional(cells.payment_sequence.as_deref())
            .is_some_and(|value| !value.bytes().all(|byte| byte.is_ascii_digit()))
    {
        return Err(invalid_request());
    }
    Ok(())
}

fn map_source(cells: &ImportSourceCells) -> Result<MappedContractPolicy, AppError> {
    let insurer = required_domain_text(cells.insurer.as_deref())?;
    let product_name = required_domain_text(cells.product_name.as_deref())?;
    let status = optional_domain_text(cells.status.as_deref())?;
    let payment_term = optional_domain_text(cells.payment_term.as_deref())?;
    let joined_on = normalize_optional(cells.contracted_on.as_deref());
    let matures_on = normalize_optional(cells.coverage_ends_on.as_deref());
    let premium =
        normalize_optional(cells.payment_premium.as_deref()).ok_or_else(invalid_request)?;
    if !premium.bytes().all(|byte| byte.is_ascii_digit()) {
        return Err(invalid_request());
    }
    let monthly_premium_won = premium
        .parse::<i64>()
        .map_err(|_| invalid_request())?
        .to_string();
    Ok(MappedContractPolicy {
        insurer,
        product_name,
        joined_on,
        status,
        monthly_premium_won,
        matures_on,
        payment_term,
        coverage_term: None,
        disclosure_plan: None,
        renewable: false,
        is_included: true,
    })
}

fn required_domain_text(value: Option<&str>) -> Result<String, AppError> {
    let value = normalize_optional(value).ok_or_else(invalid_request)?;
    if value.chars().count() > 200 {
        return Err(invalid_request());
    }
    Ok(value)
}

fn optional_domain_text(value: Option<&str>) -> Result<Option<String>, AppError> {
    let value = normalize_optional(value);
    if value
        .as_deref()
        .is_some_and(|value| value.chars().count() > 200)
    {
        return Err(invalid_request());
    }
    Ok(value)
}

fn source_values(cells: &ImportSourceCells) -> [Option<&str>; 21] {
    [
        cells.no.as_deref(),
        cells.collection_reflected_on.as_deref(),
        cells.affiliation.as_deref(),
        cells.manager.as_deref(),
        cells.collection_code.as_deref(),
        cells.contract.as_deref(),
        cells.insurer.as_deref(),
        cells.product_name.as_deref(),
        cells.policy_number.as_deref(),
        cells.contracted_on.as_deref(),
        cells.status.as_deref(),
        cells.final_payment_month.as_deref(),
        cells.payment_sequence.as_deref(),
        cells.payment_premium.as_deref(),
        cells.contractor.as_deref(),
        cells.insured.as_deref(),
        cells.coverage_starts_on.as_deref(),
        cells.coverage_ends_on.as_deref(),
        cells.collection_method.as_deref(),
        cells.payment_term.as_deref(),
        cells.original_recruiter_name.as_deref(),
    ]
}

fn normalize(value: &str) -> String {
    trim_ecmascript_whitespace(value).nfc().collect()
}

fn normalize_optional(value: Option<&str>) -> Option<String> {
    value.map(normalize).filter(|value| !value.is_empty())
}

fn validate_client_key(value: &str) -> Result<(), AppError> {
    if value.is_empty()
        || value.len() > 100
        || !value
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'-' | b'_'))
    {
        return Err(invalid_request());
    }
    Ok(())
}

fn validate_uuid(value: &str) -> Result<(), AppError> {
    let valid = Uuid::parse_str(value)
        .map(|parsed| parsed.hyphenated().to_string() == value)
        .unwrap_or(false);
    valid.then_some(()).ok_or_else(invalid_request)
}

fn is_date_only(value: &str) -> bool {
    value.len() == 10
        && value.as_bytes()[..4].iter().all(u8::is_ascii_digit)
        && &value[..4] != "0000"
        && NaiveDate::parse_from_str(value, "%Y-%m-%d")
            .map(|date| date.format("%Y-%m-%d").to_string() == value)
            .unwrap_or(false)
}

fn is_year_month(value: &str) -> bool {
    value.len() == 6
        && value.bytes().all(|byte| byte.is_ascii_digit())
        && &value[..4] != "0000"
        && value[4..6]
            .parse::<u8>()
            .is_ok_and(|month| (1..=12).contains(&month))
}

fn invalid_request() -> AppError {
    AppError::Validation(BTreeMap::from([(
        "rows".to_owned(),
        "가져오기 행과 결정을 다시 확인해 주세요.".to_owned(),
    )]))
}

#[cfg(test)]
mod tests {
    use super::is_year_month;

    #[test]
    fn year_month_matches_the_frontend_calendar_year_contract() {
        assert!(is_year_month("000101"));
        assert!(is_year_month("999912"));
        assert!(!is_year_month("000001"));
        assert!(!is_year_month("202613"));
    }
}
