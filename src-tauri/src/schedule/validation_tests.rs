use serde_json::json;

use crate::error::AppError;

use super::model::{CreateScheduleInput, UpdateScheduleInput};
use super::validation::{
    validate_create, validate_range, validate_schedule_id, validate_update, MAX_MEMO_CHARS,
    MAX_SCHEDULE_DATE, MAX_TITLE_CHARS,
};

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";

fn create_input() -> CreateScheduleInput {
    CreateScheduleInput {
        title: "  합성 일정  ".to_owned(),
        scheduled_on: " 2026-08-06 ".to_owned(),
        scheduled_time: Some(" 09:05 ".to_owned()),
        memo: Some("  합성 메모  ".to_owned()),
        customer_id: Some(CUSTOMER_ID.to_owned()),
        is_completed: false,
    }
}

#[test]
fn normalizes_fields_and_preserves_local_date_time() {
    let write = validate_create(create_input()).expect("valid schedule");
    assert_eq!(write.title, "합성 일정");
    assert_eq!(write.scheduled_on, "2026-08-06");
    assert_eq!(write.scheduled_time.as_deref(), Some("09:05"));
    assert_eq!(write.memo.as_deref(), Some("합성 메모"));
    assert_eq!(write.customer_id.as_deref(), Some(CUSTOMER_ID));
    assert!(!write.is_completed);

    let mut empty = create_input();
    empty.scheduled_time = None;
    empty.memo = Some(" \n ".to_owned());
    empty.customer_id = None;
    empty.is_completed = true;
    let empty = validate_create(empty).expect("nullable schedule fields");
    assert_eq!(empty.scheduled_time, None);
    assert_eq!(empty.memo, None);
    assert_eq!(empty.customer_id, None);
    assert!(empty.is_completed);

    let mut ecmascript_trimmed = create_input();
    ecmascript_trimmed.title = "\u{feff}합성 일정\u{feff}".to_owned();
    ecmascript_trimmed.memo = Some("\u{feff}합성 메모\u{feff}".to_owned());
    let ecmascript_trimmed =
        validate_create(ecmascript_trimmed).expect("ECMAScript whitespace trim");
    assert_eq!(ecmascript_trimmed.title, "합성 일정");
    assert_eq!(ecmascript_trimmed.memo.as_deref(), Some("합성 메모"));
}

#[test]
fn rejects_invalid_required_date_time_and_ids_without_echoing_values() {
    let cases = [
        ("title", "synthetic-title-marker"),
        ("scheduledOn", "synthetic-date-marker"),
        ("scheduledTime", "synthetic-time-marker"),
        ("customerId", "synthetic-customer-marker"),
    ];
    for (field, marker) in cases {
        let mut input = create_input();
        match field {
            "title" => input.title = "  ".to_owned(),
            "scheduledOn" => input.scheduled_on = marker.to_owned(),
            "scheduledTime" => input.scheduled_time = Some(marker.to_owned()),
            "customerId" => input.customer_id = Some(marker.to_owned()),
            _ => unreachable!(),
        }
        let error = validate_create(input).expect_err("invalid schedule field");
        let encoded = serde_json::to_string(&error).expect("serialize validation error");
        assert!(encoded.contains(field));
        assert!(!encoded.contains(marker));
    }

    for rejected in ["24:00", "09:60", "9:05", "09:05:00", ""] {
        let mut input = create_input();
        input.scheduled_time = Some(rejected.to_owned());
        let error = validate_create(input).expect_err("invalid wall-clock time");
        assert!(matches!(error, AppError::Validation(_)));
    }
    for rejected in [
        "0000-08-06",
        "2025-02-29",
        "2026-02-30",
        "2026/08/06",
        "9999-01-01",
    ] {
        let mut input = create_input();
        input.scheduled_on = rejected.to_owned();
        assert!(matches!(
            validate_create(input),
            Err(AppError::Validation(_))
        ));
    }

    let mut maximum = create_input();
    maximum.scheduled_on = MAX_SCHEDULE_DATE.to_owned();
    validate_create(maximum).expect("maximum supported schedule date");
}

#[test]
fn bounds_unicode_title_and_memo_by_scalar_count() {
    let mut accepted = create_input();
    accepted.title = "🗓".repeat(MAX_TITLE_CHARS);
    accepted.memo = Some("가".repeat(MAX_MEMO_CHARS));
    validate_create(accepted).expect("maximum Unicode schedule lengths");

    let mut rejected = create_input();
    rejected.title = "가".repeat(MAX_TITLE_CHARS + 1);
    rejected.memo = Some("🗓".repeat(MAX_MEMO_CHARS + 1));
    let AppError::Validation(fields) = validate_create(rejected).expect_err("oversized schedule")
    else {
        panic!("expected validation error");
    };
    assert!(fields.contains_key("title"));
    assert!(fields.contains_key("memo"));
}

#[test]
fn validates_half_open_date_range_and_canonical_schedule_id() {
    let range = validate_range(" 2026-08-01 ".to_owned(), " 2026-09-01 ".to_owned())
        .expect("valid month range");
    assert_eq!(range.start_on, "2026-08-01");
    assert_eq!(range.end_before, "2026-09-01");
    let upper_range = validate_range("9998-12-01".to_owned(), "9999-01-01".to_owned())
        .expect("upper supported Calendar range");
    assert_eq!(upper_range.end_before, "9999-01-01");

    for (start, end) in [
        ("2026-08-01", "2026-08-01"),
        ("2026-09-01", "2026-08-01"),
        ("2026-08-01", "2026-02-30"),
        ("0000-08-01", "0000-09-01"),
    ] {
        assert!(matches!(
            validate_range(start.to_owned(), end.to_owned()),
            Err(AppError::Validation(_))
        ));
    }
    let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
    assert_eq!(
        validate_schedule_id(canonical.to_owned()).expect("canonical schedule UUID"),
        canonical
    );
    assert!(validate_schedule_id(canonical.to_uppercase()).is_err());
}

#[test]
fn serde_requires_every_field_and_rejects_unknown_or_wrong_boolean() {
    let complete = || {
        json!({
            "title": "합성 일정",
            "scheduledOn": "2026-08-06",
            "scheduledTime": null,
            "memo": null,
            "customerId": null,
            "isCompleted": false
        })
    };
    let created: CreateScheduleInput =
        serde_json::from_value(complete()).expect("complete create input");
    validate_create(created).expect("valid strict create input");
    let updated: UpdateScheduleInput =
        serde_json::from_value(complete()).expect("complete update input");
    validate_update(updated).expect("valid strict update input");

    for field in [
        "title",
        "scheduledOn",
        "scheduledTime",
        "memo",
        "customerId",
        "isCompleted",
    ] {
        let mut missing = complete();
        missing.as_object_mut().expect("object").remove(field);
        assert!(
            serde_json::from_value::<CreateScheduleInput>(missing.clone()).is_err(),
            "create missing {field} must fail"
        );
        assert!(
            serde_json::from_value::<UpdateScheduleInput>(missing).is_err(),
            "update missing {field} must fail"
        );
    }
    let mut unknown = complete();
    unknown["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<CreateScheduleInput>(unknown).is_err());
    let mut wrong_boolean = complete();
    wrong_boolean["isCompleted"] = json!("false");
    assert!(serde_json::from_value::<UpdateScheduleInput>(wrong_boolean).is_err());
}
