use serde_json::json;

use crate::error::AppError;

use super::model::{CreateConsultationInput, UpdateConsultationInput};
use super::validation::{
    validate_consultation_id, validate_create, validate_customer_id, validate_update,
    MAX_CONTENT_CHARS, MAX_RESULT_CHARS,
};

fn create_input() -> CreateConsultationInput {
    CreateConsultationInput {
        consulted_at: " 2026-08-06T12:34:56+09:00 ".to_owned(),
        content: Some("  합성 상담 기록  ".to_owned()),
        next_contact_on: Some(" 2026-08-31 ".to_owned()),
        result: Some("  합성 결과  ".to_owned()),
    }
}

#[test]
fn normalizes_timestamp_date_and_optional_text() {
    let write = validate_create(create_input()).expect("valid consultation");
    assert_eq!(write.consulted_at, "2026-08-06T03:34:56.000Z");
    assert_eq!(write.content.as_deref(), Some("합성 상담 기록"));
    assert_eq!(write.next_contact_on.as_deref(), Some("2026-08-31"));
    assert_eq!(write.result.as_deref(), Some("합성 결과"));

    let empty = validate_create(CreateConsultationInput {
        consulted_at: "2026-08-06T03:34:56Z".to_owned(),
        content: Some(" \n ".to_owned()),
        next_contact_on: Some(" ".to_owned()),
        result: None,
    })
    .expect("blank optionals normalize to null");
    assert_eq!(empty.consulted_at, "2026-08-06T03:34:56.000Z");
    assert_eq!(empty.content, None);
    assert_eq!(empty.next_contact_on, None);
    assert_eq!(empty.result, None);
}

#[test]
fn rejects_invalid_timestamps_and_dates_without_reflecting_values() {
    for rejected in [
        "2026-08-06T12:34:56",
        "2026-02-30T12:34:56+09:00",
        "synthetic-rejected-timestamp-marker",
    ] {
        let mut input = create_input();
        input.consulted_at = rejected.to_owned();
        let error = validate_create(input).expect_err("invalid timestamp");
        let encoded = serde_json::to_string(&error).expect("serialize error");
        assert!(encoded.contains("consultedAt"));
        assert!(!encoded.contains(rejected));
    }

    for rejected in ["2025-02-29", "2026/08/31", "date-rejected-marker"] {
        let mut input = create_input();
        input.next_contact_on = Some(rejected.to_owned());
        let error = validate_create(input).expect_err("invalid date-only value");
        let encoded = serde_json::to_string(&error).expect("serialize error");
        assert!(encoded.contains("nextContactOn"));
        assert!(!encoded.contains(rejected));
    }
}

#[test]
fn bounds_unicode_content_and_result_by_scalar_count() {
    let mut accepted = create_input();
    accepted.content = Some("📝".repeat(MAX_CONTENT_CHARS));
    accepted.result = Some("가".repeat(MAX_RESULT_CHARS));
    validate_create(accepted).expect("maximum Unicode text lengths");

    let mut rejected = create_input();
    rejected.content = Some("나".repeat(MAX_CONTENT_CHARS + 1));
    rejected.result = Some("📝".repeat(MAX_RESULT_CHARS + 1));
    let AppError::Validation(fields) = validate_create(rejected).expect_err("oversized text")
    else {
        panic!("expected validation error");
    };
    assert!(fields.contains_key("content"));
    assert!(fields.contains_key("result"));
}

#[test]
fn serde_is_strict_and_update_requires_explicit_nullable_fields() {
    let minimal: CreateConsultationInput = serde_json::from_value(json!({
        "consultedAt": "2026-08-06T03:34:56Z"
    }))
    .expect("create optional defaults");
    assert_eq!(minimal.content, None);
    assert_eq!(minimal.next_contact_on, None);
    assert_eq!(minimal.result, None);

    let complete = || {
        json!({
            "consultedAt": "2026-08-06T03:34:56Z",
            "content": null,
            "nextContactOn": null,
            "result": null
        })
    };
    let parsed: UpdateConsultationInput =
        serde_json::from_value(complete()).expect("complete update");
    validate_update(parsed).expect("valid update");

    for field in ["consultedAt", "content", "nextContactOn", "result"] {
        let mut missing = complete();
        missing.as_object_mut().expect("object").remove(field);
        assert!(
            serde_json::from_value::<UpdateConsultationInput>(missing).is_err(),
            "missing {field} must fail"
        );
    }

    let mut unknown_create = json!({ "consultedAt": "2026-08-06T03:34:56Z" });
    unknown_create["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<CreateConsultationInput>(unknown_create).is_err());
    let mut unknown_update = complete();
    unknown_update["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<UpdateConsultationInput>(unknown_update).is_err());
}

#[test]
fn validates_canonical_ids_without_echoing_rejected_values() {
    let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
    assert_eq!(
        validate_customer_id(canonical.to_owned()).expect("customer UUID"),
        canonical
    );
    assert_eq!(
        validate_consultation_id(canonical.to_owned()).expect("consultation UUID"),
        canonical
    );

    for invalid in [
        "FEF9EFC5-74C7-485A-B0D5-6BB8A3FF02C8",
        "fef9efc574c7485ab0d56bb8a3ff02c8",
        " synthetic-rejected-id-marker ",
    ] {
        let error = validate_consultation_id(invalid.to_owned()).expect_err("invalid UUID");
        let encoded = serde_json::to_string(&error).expect("serialize error");
        assert!(encoded.contains("VALIDATION_ERROR"));
        assert!(!encoded.contains(invalid));
    }
}
