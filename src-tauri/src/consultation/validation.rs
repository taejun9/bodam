use std::collections::BTreeMap;

use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use uuid::Uuid;

use crate::error::AppError;

use super::model::{ConsultationWrite, CreateConsultationInput, UpdateConsultationInput};

pub(crate) const MAX_CONTENT_CHARS: usize = 4_000;
pub(crate) const MAX_RESULT_CHARS: usize = 200;

pub(crate) fn validate_create(
    input: CreateConsultationInput,
) -> Result<ConsultationWrite, AppError> {
    validate(
        input.consulted_at,
        input.content,
        input.next_contact_on,
        input.result,
    )
}

pub(crate) fn validate_update(
    input: UpdateConsultationInput,
) -> Result<ConsultationWrite, AppError> {
    validate(
        input.consulted_at,
        input.content,
        input.next_contact_on,
        input.result,
    )
}

pub(crate) fn validate_customer_id(id: String) -> Result<String, AppError> {
    validate_id(id, "customerId", "올바른 고객 식별자가 필요합니다.")
}

pub(crate) fn validate_consultation_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 상담 식별자가 필요합니다.")
}

fn validate(
    consulted_at: String,
    content: Option<String>,
    next_contact_on: Option<String>,
    result: Option<String>,
) -> Result<ConsultationWrite, AppError> {
    let mut fields = BTreeMap::new();
    let consulted_at = normalize_timestamp(consulted_at, &mut fields);
    let content = normalize_optional_text(
        content,
        "content",
        MAX_CONTENT_CHARS,
        "상담 내용",
        &mut fields,
    );
    let next_contact_on = normalize_date(next_contact_on, &mut fields);
    let result =
        normalize_optional_text(result, "result", MAX_RESULT_CHARS, "상담 결과", &mut fields);

    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }

    Ok(ConsultationWrite {
        consulted_at: consulted_at.expect("validated timestamp must be present"),
        content,
        next_contact_on,
        result,
    })
}

fn normalize_timestamp(value: String, fields: &mut BTreeMap<String, String>) -> Option<String> {
    let normalized = value.trim();
    let parsed = DateTime::parse_from_rfc3339(normalized).ok();
    if parsed.is_none() {
        fields.insert(
            "consultedAt".to_owned(),
            "상담 일시는 timezone offset이 있는 RFC 3339 형식이어야 합니다.".to_owned(),
        );
    }
    parsed.map(|timestamp| {
        timestamp
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Millis, true)
    })
}

fn normalize_optional_text(
    value: Option<String>,
    field: &str,
    max_chars: usize,
    label: &str,
    fields: &mut BTreeMap<String, String>,
) -> Option<String> {
    let normalized = value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if normalized
        .as_deref()
        .is_some_and(|value| value.chars().count() > max_chars)
    {
        fields.insert(
            field.to_owned(),
            format!("{label}은(는) {max_chars}자 이내로 입력해 주세요."),
        );
    }
    normalized
}

fn normalize_date(value: Option<String>, fields: &mut BTreeMap<String, String>) -> Option<String> {
    let normalized = value.and_then(|value| {
        let trimmed = value.trim().to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if normalized
        .as_deref()
        .is_some_and(|value| !is_date_only(value))
    {
        fields.insert(
            "nextContactOn".to_owned(),
            "다음 연락일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.".to_owned(),
        );
    }
    normalized
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
