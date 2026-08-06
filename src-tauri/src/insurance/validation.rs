use std::collections::BTreeMap;

use chrono::NaiveDate;
use uuid::Uuid;

use crate::error::AppError;

use super::model::{CreateInsurancePolicyInput, InsurancePolicyWrite, UpdateInsurancePolicyInput};

pub(crate) const MAX_TEXT_CHARS: usize = 200;

pub(crate) fn validate_create(
    input: CreateInsurancePolicyInput,
) -> Result<InsurancePolicyWrite, AppError> {
    validate(
        input.insurer,
        input.product_name,
        input.joined_on,
        input.coverage_term,
        input.payment_term,
        input.monthly_premium_won,
        input.disclosure_plan,
        input.matures_on,
        input.renewable,
        input.status,
        input.is_included,
    )
}

pub(crate) fn validate_update(
    input: UpdateInsurancePolicyInput,
) -> Result<InsurancePolicyWrite, AppError> {
    validate(
        input.insurer,
        input.product_name,
        input.joined_on,
        input.coverage_term,
        input.payment_term,
        input.monthly_premium_won,
        input.disclosure_plan,
        input.matures_on,
        input.renewable,
        input.status,
        input.is_included,
    )
}

pub(crate) fn validate_customer_id(id: String) -> Result<String, AppError> {
    validate_id(id, "customerId", "올바른 고객 식별자가 필요합니다.")
}

pub(crate) fn validate_policy_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 보험계약 식별자가 필요합니다.")
}

#[allow(clippy::too_many_arguments)]
fn validate(
    insurer: String,
    product_name: String,
    joined_on: Option<String>,
    coverage_term: Option<String>,
    payment_term: Option<String>,
    monthly_premium_won: String,
    disclosure_plan: Option<String>,
    matures_on: Option<String>,
    renewable: bool,
    status: Option<String>,
    is_included: bool,
) -> Result<InsurancePolicyWrite, AppError> {
    let mut fields = BTreeMap::new();
    let insurer = normalize_required(insurer, "insurer", "보험사", &mut fields);
    let product_name = normalize_required(product_name, "productName", "상품명", &mut fields);
    let joined_on = normalize_date(joined_on, "joinedOn", &mut fields);
    let coverage_term = normalize_optional_text(coverage_term, "coverageTerm", &mut fields);
    let payment_term = normalize_optional_text(payment_term, "paymentTerm", &mut fields);
    let disclosure_plan = normalize_optional_text(disclosure_plan, "disclosurePlan", &mut fields);
    let matures_on = normalize_date(matures_on, "maturesOn", &mut fields);
    let status = normalize_optional_text(status, "status", &mut fields);
    let monthly_premium_won = parse_money(&monthly_premium_won, &mut fields);

    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }

    Ok(InsurancePolicyWrite {
        insurer,
        product_name,
        joined_on,
        coverage_term,
        payment_term,
        monthly_premium_won: monthly_premium_won.expect("validated money must be present"),
        disclosure_plan,
        matures_on,
        renewable,
        status,
        is_included,
    })
}

fn normalize_required(
    value: String,
    field: &str,
    label: &str,
    fields: &mut BTreeMap<String, String>,
) -> String {
    let normalized = value.trim().to_owned();
    if normalized.is_empty() {
        fields.insert(field.to_owned(), format!("{label}을(를) 입력해 주세요."));
    } else if normalized.chars().count() > MAX_TEXT_CHARS {
        fields.insert(
            field.to_owned(),
            format!("{label}은(는) {MAX_TEXT_CHARS}자 이내로 입력해 주세요."),
        );
    }
    normalized
}

fn normalize_optional_text(
    value: Option<String>,
    field: &str,
    fields: &mut BTreeMap<String, String>,
) -> Option<String> {
    let normalized = value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if normalized
        .as_deref()
        .is_some_and(|value| value.chars().count() > MAX_TEXT_CHARS)
    {
        fields.insert(
            field.to_owned(),
            format!("{MAX_TEXT_CHARS}자 이내로 입력해 주세요."),
        );
    }
    normalized
}

fn normalize_date(
    value: Option<String>,
    field: &str,
    fields: &mut BTreeMap<String, String>,
) -> Option<String> {
    let normalized = value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if normalized
        .as_deref()
        .is_some_and(|value| !is_date_only(value))
    {
        fields.insert(
            field.to_owned(),
            "날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.".to_owned(),
        );
    }
    normalized
}

fn parse_money(value: &str, fields: &mut BTreeMap<String, String>) -> Option<i64> {
    let bytes = value.as_bytes();
    let canonical = bytes == b"0"
        || bytes
            .first()
            .is_some_and(|first| (b'1'..=b'9').contains(first))
            && bytes[1..].iter().all(u8::is_ascii_digit);
    let parsed = canonical.then(|| value.parse::<i64>().ok()).flatten();
    if parsed.is_none() {
        fields.insert(
            "monthlyPremiumWon".to_owned(),
            "월보험료는 0 이상의 원 단위 정수여야 합니다.".to_owned(),
        );
    }
    parsed
}

fn validate_id(id: String, field: &str, message: &str) -> Result<String, AppError> {
    let canonical = Uuid::parse_str(&id)
        .map(|parsed| parsed.hyphenated().to_string() == id)
        .unwrap_or(false);
    if !canonical {
        return Err(AppError::Validation(BTreeMap::from([(
            field.to_owned(),
            message.to_owned(),
        )])));
    }
    Ok(id)
}

fn is_date_only(value: &str) -> bool {
    let bytes = value.as_bytes();
    let shape_is_valid = bytes.len() == 10
        && bytes[0..4].iter().all(u8::is_ascii_digit)
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(u8::is_ascii_digit);
    shape_is_valid && NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}
