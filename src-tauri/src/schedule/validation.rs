use std::collections::BTreeMap;

use chrono::NaiveDate;
use uuid::Uuid;

use crate::error::AppError;
use crate::text::trim_ecmascript_whitespace;

use super::model::{CreateScheduleInput, ScheduleRange, ScheduleWrite, UpdateScheduleInput};

pub(crate) const MAX_TITLE_CHARS: usize = 200;
pub(crate) const MAX_MEMO_CHARS: usize = 4_000;
pub(crate) const MAX_SCHEDULE_DATE: &str = "9998-12-31";

pub(crate) fn validate_create(input: CreateScheduleInput) -> Result<ScheduleWrite, AppError> {
    validate(
        input.title,
        input.scheduled_on,
        input.scheduled_time,
        input.memo,
        input.customer_id,
        input.is_completed,
    )
}

pub(crate) fn validate_update(input: UpdateScheduleInput) -> Result<ScheduleWrite, AppError> {
    validate(
        input.title,
        input.scheduled_on,
        input.scheduled_time,
        input.memo,
        input.customer_id,
        input.is_completed,
    )
}

pub(crate) fn validate_range(
    start_on: String,
    end_before: String,
) -> Result<ScheduleRange, AppError> {
    let mut fields = BTreeMap::new();
    let start_on = normalize_date(start_on, "startOn", "시작일", &mut fields);
    let end_before = normalize_date(end_before, "endBefore", "종료일", &mut fields);
    if fields.is_empty() && start_on >= end_before {
        fields.insert(
            "endBefore".to_owned(),
            "종료일은 시작일보다 뒤여야 합니다.".to_owned(),
        );
    }
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(ScheduleRange {
        start_on,
        end_before,
    })
}

pub(crate) fn validate_schedule_id(id: String) -> Result<String, AppError> {
    validate_id(id, "id", "올바른 일정 식별자가 필요합니다.")
}

fn validate(
    title: String,
    scheduled_on: String,
    scheduled_time: Option<String>,
    memo: Option<String>,
    customer_id: Option<String>,
    is_completed: bool,
) -> Result<ScheduleWrite, AppError> {
    let mut fields = BTreeMap::new();
    let title = normalize_title(title, &mut fields);
    let scheduled_on =
        normalize_schedule_date(scheduled_on, "scheduledOn", "일정 날짜", &mut fields);
    let scheduled_time = normalize_time(scheduled_time, &mut fields);
    let memo = normalize_memo(memo, &mut fields);
    let customer_id = normalize_customer_id(customer_id, &mut fields);
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(ScheduleWrite {
        title,
        scheduled_on,
        scheduled_time,
        memo,
        customer_id,
        is_completed,
    })
}

fn normalize_title(value: String, fields: &mut BTreeMap<String, String>) -> String {
    let normalized = trim_ecmascript_whitespace(&value).to_owned();
    if normalized.is_empty() {
        fields.insert("title".to_owned(), "일정 제목을 입력해 주세요.".to_owned());
    } else if normalized.chars().count() > MAX_TITLE_CHARS {
        fields.insert(
            "title".to_owned(),
            format!("일정 제목은 {MAX_TITLE_CHARS}자 이내로 입력해 주세요."),
        );
    }
    normalized
}

fn normalize_date(
    value: String,
    field: &str,
    label: &str,
    fields: &mut BTreeMap<String, String>,
) -> String {
    let normalized = trim_ecmascript_whitespace(&value).to_owned();
    if !is_date_only(&normalized) {
        fields.insert(
            field.to_owned(),
            format!("{label}은(는) YYYY-MM-DD 형식의 실제 날짜여야 합니다."),
        );
    }
    normalized
}

fn normalize_schedule_date(
    value: String,
    field: &str,
    label: &str,
    fields: &mut BTreeMap<String, String>,
) -> String {
    let normalized = normalize_date(value, field, label, fields);
    if !fields.contains_key(field) && normalized.as_str() > MAX_SCHEDULE_DATE {
        fields.insert(
            field.to_owned(),
            format!("{label}은(는) {MAX_SCHEDULE_DATE} 이하여야 합니다."),
        );
    }
    normalized
}

fn normalize_time(value: Option<String>, fields: &mut BTreeMap<String, String>) -> Option<String> {
    let normalized = value.map(|value| trim_ecmascript_whitespace(&value).to_owned());
    if normalized.as_deref().is_some_and(|value| !is_time(value)) {
        fields.insert(
            "scheduledTime".to_owned(),
            "일정 시간은 HH:mm 형식의 실제 시각이어야 합니다.".to_owned(),
        );
    }
    normalized
}

fn normalize_memo(value: Option<String>, fields: &mut BTreeMap<String, String>) -> Option<String> {
    let normalized = value.and_then(|value| {
        let trimmed = trim_ecmascript_whitespace(&value).to_owned();
        (!trimmed.is_empty()).then_some(trimmed)
    });
    if normalized
        .as_deref()
        .is_some_and(|value| value.chars().count() > MAX_MEMO_CHARS)
    {
        fields.insert(
            "memo".to_owned(),
            format!("일정 메모는 {MAX_MEMO_CHARS}자 이내로 입력해 주세요."),
        );
    }
    normalized
}

fn normalize_customer_id(
    value: Option<String>,
    fields: &mut BTreeMap<String, String>,
) -> Option<String> {
    if value.as_deref().is_some_and(|id| !is_canonical_uuid(id)) {
        fields.insert(
            "customerId".to_owned(),
            "올바른 고객 식별자가 필요합니다.".to_owned(),
        );
    }
    value
}

fn validate_id(id: String, field: &str, message: &str) -> Result<String, AppError> {
    if !is_canonical_uuid(&id) {
        return Err(AppError::Validation(BTreeMap::from([(
            field.to_owned(),
            message.to_owned(),
        )])));
    }
    Ok(id)
}

fn is_canonical_uuid(value: &str) -> bool {
    Uuid::parse_str(value)
        .map(|parsed| parsed.hyphenated().to_string() == value)
        .unwrap_or(false)
}

fn is_date_only(value: &str) -> bool {
    let bytes = value.as_bytes();
    let shape_is_valid = bytes.len() == 10
        && bytes[0..4].iter().all(u8::is_ascii_digit)
        && &bytes[0..4] != b"0000"
        && bytes[4] == b'-'
        && bytes[5..7].iter().all(u8::is_ascii_digit)
        && bytes[7] == b'-'
        && bytes[8..10].iter().all(u8::is_ascii_digit);
    shape_is_valid && NaiveDate::parse_from_str(value, "%Y-%m-%d").is_ok()
}

fn is_time(value: &str) -> bool {
    let bytes = value.as_bytes();
    bytes.len() == 5
        && bytes[0..2].iter().all(u8::is_ascii_digit)
        && bytes[2] == b':'
        && bytes[3..5].iter().all(u8::is_ascii_digit)
        && value[0..2].parse::<u8>().is_ok_and(|hour| hour < 24)
        && value[3..5].parse::<u8>().is_ok_and(|minute| minute < 60)
}
