use std::collections::BTreeMap;

use uuid::Uuid;

use crate::error::AppError;

use super::model::{
    AddFamilyMembershipInput, CreateFamilyInput, MembershipWrite, UpdateFamilyInput,
    UpdateFamilyMembershipInput,
};

pub(crate) const MAX_FAMILY_TEXT_CHARS: usize = 100;

pub(crate) fn validate_create(input: CreateFamilyInput) -> Result<String, AppError> {
    validate_name(input.name)
}

pub(crate) fn validate_update(input: UpdateFamilyInput) -> Result<String, AppError> {
    validate_name(input.name)
}

pub(crate) fn validate_search(search: Option<String>) -> Result<Option<String>, AppError> {
    let normalized = normalize_optional(search);
    if normalized
        .as_deref()
        .is_some_and(|value| value.chars().count() > MAX_FAMILY_TEXT_CHARS)
    {
        return Err(validation_error(
            "search",
            "검색어는 100자 이내로 입력해 주세요.",
        ));
    }
    Ok(normalized)
}

pub(crate) fn validate_family_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 가족 식별자가 필요합니다.")
}

pub(crate) fn validate_parent_family_id(id: String) -> Result<String, AppError> {
    validate_id(id, "familyId", "올바른 가족 식별자가 필요합니다.")
}

pub(crate) fn validate_membership_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 가족 구성원 식별자가 필요합니다.")
}

pub(crate) fn validate_add(input: AddFamilyMembershipInput) -> Result<MembershipWrite, AppError> {
    let relationship_name = normalize_optional(input.relationship_name);
    let mut fields = BTreeMap::new();
    if !is_canonical_uuid(&input.customer_id) {
        fields.insert(
            "customerId".to_owned(),
            "올바른 고객 식별자가 필요합니다.".to_owned(),
        );
    }
    validate_relationship(&relationship_name, &mut fields);
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(MembershipWrite {
        customer_id: input.customer_id,
        relationship_name,
    })
}

pub(crate) fn validate_membership_update(
    input: UpdateFamilyMembershipInput,
) -> Result<Option<String>, AppError> {
    let relationship_name = normalize_optional(input.relationship_name);
    let mut fields = BTreeMap::new();
    validate_relationship(&relationship_name, &mut fields);
    if fields.is_empty() {
        Ok(relationship_name)
    } else {
        Err(AppError::Validation(fields))
    }
}

fn validate_name(name: String) -> Result<String, AppError> {
    let name = name.trim().to_owned();
    if name.is_empty() {
        return Err(validation_error("name", "가족 이름을 입력해 주세요."));
    }
    if name.chars().count() > MAX_FAMILY_TEXT_CHARS {
        return Err(validation_error(
            "name",
            "가족 이름은 100자 이내로 입력해 주세요.",
        ));
    }
    Ok(name)
}

fn validate_relationship(value: &Option<String>, fields: &mut BTreeMap<String, String>) {
    if value
        .as_deref()
        .is_some_and(|name| name.chars().count() > MAX_FAMILY_TEXT_CHARS)
    {
        fields.insert(
            "relationshipName".to_owned(),
            "관계명은 100자 이내로 입력해 주세요.".to_owned(),
        );
    }
}

fn normalize_optional(value: Option<String>) -> Option<String> {
    value.and_then(|value| {
        let normalized = value.trim().to_owned();
        (!normalized.is_empty()).then_some(normalized)
    })
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
