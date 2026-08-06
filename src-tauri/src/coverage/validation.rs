use std::collections::BTreeMap;

use uuid::Uuid;

use crate::error::AppError;

use super::model::{
    CoverageWrite, CreateCoverageInput, UpdateCoverageCategoryInput, UpdateCoverageInput,
};

pub(crate) const MAX_CATEGORY_NAME_CHARS: usize = 100;

pub(crate) fn validate_category_update(
    input: UpdateCoverageCategoryInput,
) -> Result<String, AppError> {
    let name = input.name.trim().to_owned();
    if name.is_empty() {
        return Err(validation_error("name", "카테고리 이름을 입력해 주세요."));
    }
    if name.chars().count() > MAX_CATEGORY_NAME_CHARS {
        return Err(validation_error(
            "name",
            "카테고리 이름은 100자 이내로 입력해 주세요.",
        ));
    }
    Ok(name)
}

pub(crate) fn validate_create(input: CreateCoverageInput) -> Result<CoverageWrite, AppError> {
    validate_coverage(input.category_id, input.amount_won)
}

pub(crate) fn validate_update(input: UpdateCoverageInput) -> Result<CoverageWrite, AppError> {
    validate_coverage(input.category_id, input.amount_won)
}

pub(crate) fn validate_customer_id(id: String) -> Result<String, AppError> {
    validate_id(id, "customerId", "올바른 고객 식별자가 필요합니다.")
}

pub(crate) fn validate_policy_id(id: String) -> Result<String, AppError> {
    validate_id(id, "policyId", "올바른 보험계약 식별자가 필요합니다.")
}

pub(crate) fn validate_category_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 보장 카테고리 식별자가 필요합니다.")
}

pub(crate) fn validate_coverage_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 보장 식별자가 필요합니다.")
}

fn validate_coverage(category_id: String, amount_won: String) -> Result<CoverageWrite, AppError> {
    let mut fields = BTreeMap::new();
    if !is_canonical_uuid(&category_id) {
        fields.insert(
            "categoryId".to_owned(),
            "올바른 보장 카테고리 식별자가 필요합니다.".to_owned(),
        );
    }
    let amount_won = parse_money(&amount_won, &mut fields);
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(CoverageWrite {
        category_id,
        amount_won: amount_won.expect("validated money must be present"),
    })
}

fn parse_money(value: &str, fields: &mut BTreeMap<String, String>) -> Option<i64> {
    let bytes = value.as_bytes();
    let canonical = bytes == b"0"
        || bytes
            .first()
            .is_some_and(|first| (b'1'..=b'9').contains(first))
            && bytes[1..].iter().all(u8::is_ascii_digit);
    if !canonical {
        fields.insert(
            "amountWon".to_owned(),
            "보장금액은 0 이상의 원 단위 정수여야 합니다.".to_owned(),
        );
        return None;
    }
    match value.parse::<i64>() {
        Ok(parsed) => Some(parsed),
        Err(_) => {
            fields.insert(
                "amountWon".to_owned(),
                "보장금액이 저장 가능한 범위를 넘었습니다.".to_owned(),
            );
            None
        }
    }
}

fn validate_id(id: String, field: &str, message: &str) -> Result<String, AppError> {
    if !is_canonical_uuid(&id) {
        return Err(validation_error(field, message));
    }
    Ok(id)
}

fn is_canonical_uuid(value: &str) -> bool {
    Uuid::parse_str(value)
        .map(|parsed| parsed.hyphenated().to_string() == value)
        .unwrap_or(false)
}

fn validation_error(field: &str, message: &str) -> AppError {
    AppError::Validation(BTreeMap::from([(field.to_owned(), message.to_owned())]))
}
