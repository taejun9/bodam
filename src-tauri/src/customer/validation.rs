use std::collections::BTreeMap;

use chrono::NaiveDate;
use uuid::Uuid;

use crate::error::AppError;

use super::model::{CreateCustomerInput, CustomerWrite, UpdateCustomerInput};

pub(crate) const MAX_SEARCH_CHARS: usize = 100;

pub(crate) fn validate_create(input: CreateCustomerInput) -> Result<CustomerWrite, AppError> {
    validate(
        input.name,
        input.birth_date,
        input.gender,
        input.phone,
        input.address,
        input.memo,
        input.status,
        input.is_managed,
    )
}

pub(crate) fn validate_update(input: UpdateCustomerInput) -> Result<CustomerWrite, AppError> {
    validate(
        input.name,
        input.birth_date,
        input.gender,
        input.phone,
        input.address,
        input.memo,
        input.status,
        input.is_managed,
    )
}

pub(crate) fn validate_search(search: Option<String>) -> Result<Option<String>, AppError> {
    let normalized = search
        .map(|value| value.trim().to_owned())
        .filter(|value| !value.is_empty());
    if normalized
        .as_deref()
        .is_some_and(|value| value.chars().count() > MAX_SEARCH_CHARS)
    {
        return Err(validation_error(
            "search",
            "검색어는 100자 이내로 입력해 주세요.",
        ));
    }
    Ok(normalized)
}

pub(crate) fn validate_customer_id(id: String) -> Result<String, AppError> {
    let is_canonical = Uuid::parse_str(&id)
        .map(|parsed| parsed.hyphenated().to_string() == id)
        .unwrap_or(false);
    if !is_canonical {
        return Err(validation_error("id", "올바른 고객 식별자가 필요합니다."));
    }
    Ok(id)
}

#[allow(clippy::too_many_arguments)]
fn validate(
    name: String,
    birth_date: Option<String>,
    gender: Option<String>,
    phone: Option<String>,
    address: Option<String>,
    memo: Option<String>,
    status: Option<String>,
    is_managed: bool,
) -> Result<CustomerWrite, AppError> {
    let name = name.trim().to_owned();
    let birth_date = normalize_optional(birth_date);
    let mut fields = BTreeMap::new();

    if name.is_empty() {
        fields.insert("name".to_owned(), "이름을 입력해 주세요.".to_owned());
    }
    if let Some(value) = birth_date.as_deref() {
        if !is_date_only(value) {
            fields.insert(
                "birthDate".to_owned(),
                "생년월일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.".to_owned(),
            );
        }
    }
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }

    Ok(CustomerWrite {
        name,
        birth_date,
        gender: normalize_optional(gender),
        phone: normalize_optional(phone),
        address: normalize_optional(address),
        memo: normalize_optional(memo),
        status: normalize_optional(status),
        is_managed,
    })
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let normalized = value.trim().to_owned();
        (!normalized.is_empty()).then_some(normalized)
    })
}

fn validation_error(field: &str, message: &str) -> AppError {
    AppError::Validation(BTreeMap::from([(field.to_owned(), message.to_owned())]))
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn trims_and_normalizes_customer_input() {
        let result = validate_create(CreateCustomerInput {
            name: "  Synthetic Alpha  ".to_owned(),
            birth_date: Some(" 2000-02-29 ".to_owned()),
            gender: Some(" ".to_owned()),
            phone: None,
            address: None,
            memo: None,
            status: Some(" active ".to_owned()),
            is_managed: true,
        })
        .expect("valid synthetic customer");

        assert_eq!(result.name, "Synthetic Alpha");
        assert_eq!(result.birth_date.as_deref(), Some("2000-02-29"));
        assert_eq!(result.gender, None);
        assert_eq!(result.status.as_deref(), Some("active"));
    }

    #[test]
    fn rejects_blank_name_and_invalid_date() {
        let error = validate_create(CreateCustomerInput {
            name: "  ".to_owned(),
            birth_date: Some("2001-02-29".to_owned()),
            gender: None,
            phone: None,
            address: None,
            memo: None,
            status: None,
            is_managed: true,
        })
        .expect_err("invalid input must be rejected");

        let AppError::Validation(fields) = error else {
            panic!("expected validation error");
        };
        assert!(fields.contains_key("name"));
        assert!(fields.contains_key("birthDate"));
    }

    #[test]
    fn validates_canonical_customer_ids_without_echoing_rejected_values() {
        let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
        assert_eq!(
            validate_customer_id(canonical.to_owned()).expect("canonical UUID"),
            canonical
        );

        for invalid in [
            "FEF9EFC5-74C7-485A-B0D5-6BB8A3FF02C8",
            "fef9efc574c7485ab0d56bb8a3ff02c8",
            " fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8 ",
            "synthetic-rejected-id-marker",
        ] {
            let error = validate_customer_id(invalid.to_owned()).expect_err("noncanonical UUID");
            let encoded = serde_json::to_string(&error).expect("serialize validation error");
            assert!(encoded.contains("VALIDATION_ERROR"));
            assert!(!encoded.contains(invalid));
        }
    }

    #[test]
    fn bounds_and_normalizes_search_without_echoing_rejected_values() {
        assert_eq!(validate_search(Some("   ".to_owned())), Ok(None));
        assert_eq!(
            validate_search(Some("  synthetic  ".to_owned())),
            Ok(Some("synthetic".to_owned()))
        );
        assert!(validate_search(Some("가".repeat(MAX_SEARCH_CHARS))).is_ok());

        let rejected = "나".repeat(MAX_SEARCH_CHARS + 1);
        let error = validate_search(Some(rejected.clone())).expect_err("oversized search");
        let encoded = serde_json::to_string(&error).expect("serialize validation error");
        assert!(encoded.contains("VALIDATION_ERROR"));
        assert!(!encoded.contains(&rejected));
    }
}
