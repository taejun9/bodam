use serde_json::json;

use crate::error::AppError;

use super::model::{CreateCoverageBenchmarkInput, UpdateCoverageBenchmarkInput};
use super::validation::{
    validate_benchmark_id, validate_create, validate_update, MAX_AGE_YEARS, MAX_GENDER_CHARS,
};

const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";

fn input() -> CreateCoverageBenchmarkInput {
    CreateCoverageBenchmarkInput {
        category_id: CATEGORY_ID.to_owned(),
        gender: "  합성 성별  ".to_owned(),
        min_age_years: 20,
        max_age_years: 29,
        adequate_min_won: "50000000".to_owned(),
        excessive_min_won: "100000000".to_owned(),
    }
}

#[test]
fn trims_and_bounds_gender_by_unicode_scalars() {
    let write = validate_create(input()).expect("valid benchmark");
    assert_eq!(write.gender, "합성 성별");

    let mut maximum = input();
    maximum.gender = "🧭".repeat(MAX_GENDER_CHARS);
    validate_create(maximum).expect("maximum gender length");

    for rejected in [" ".to_owned(), "가".repeat(MAX_GENDER_CHARS + 1)] {
        let mut invalid = input();
        invalid.gender = rejected.clone();
        let error = validate_create(invalid).expect_err("invalid gender");
        let encoded = serde_json::to_string(&error).expect("serialize gender error");
        assert!(encoded.contains("gender"));
    }
    let rejected = "synthetic-rejected-gender-marker".repeat(4);
    let mut invalid = input();
    invalid.gender = rejected.clone();
    let encoded = serde_json::to_string(&validate_create(invalid).expect_err("oversized marker"))
        .expect("serialize marker error");
    assert!(!encoded.contains(&rejected));

    let mut byte_order_mark = input();
    byte_order_mark.gender = "\u{feff}합성 성별\u{feff}".to_owned();
    assert_eq!(
        validate_create(byte_order_mark)
            .expect("ECMAScript byte order mark trim")
            .gender,
        "합성 성별"
    );
    let mut next_line = input();
    next_line.gender = "\u{0085}합성 성별\u{0085}".to_owned();
    assert_eq!(
        validate_create(next_line)
            .expect("ECMAScript next-line preservation")
            .gender,
        "\u{0085}합성 성별\u{0085}"
    );
}

#[test]
fn validates_inclusive_age_bounds_and_order() {
    let mut bounds = input();
    bounds.min_age_years = 0;
    bounds.max_age_years = MAX_AGE_YEARS;
    validate_create(bounds).expect("inclusive age bounds");

    for (min_age, max_age, field) in [
        (-1, 20, "minAgeYears"),
        (20, 151, "maxAgeYears"),
        (30, 29, "maxAgeYears"),
    ] {
        let mut invalid = input();
        invalid.min_age_years = min_age;
        invalid.max_age_years = max_age;
        let AppError::Validation(fields) = validate_create(invalid).expect_err("invalid age")
        else {
            panic!("expected age validation error");
        };
        assert!(fields.contains_key(field));
    }
}

#[test]
fn validates_canonical_decimal_money_and_threshold_order() {
    let mut bounds = input();
    bounds.adequate_min_won = "0".to_owned();
    bounds.excessive_min_won = i64::MAX.to_string();
    let write = validate_create(bounds).expect("money bounds");
    assert_eq!(write.adequate_min_won, 0);
    assert_eq!(write.excessive_min_won, i64::MAX);

    for rejected in ["", "-1", "1.0", " 1", "1 ", "+1", "01", "９"] {
        let mut invalid = input();
        invalid.adequate_min_won = rejected.to_owned();
        let error = validate_create(invalid).expect_err("invalid adequate money");
        let encoded = serde_json::to_string(&error).expect("serialize money error");
        assert!(encoded.contains("adequateMinWon"));
    }

    let rejected_marker = "synthetic-rejected-money-marker";
    let mut invalid_marker = input();
    invalid_marker.adequate_min_won = rejected_marker.to_owned();
    let encoded =
        serde_json::to_string(&validate_create(invalid_marker).expect_err("rejected money marker"))
            .expect("serialize marker error");
    assert!(!encoded.contains(rejected_marker));

    let rejected = "9223372036854775808";
    let mut overflow = input();
    overflow.excessive_min_won = rejected.to_owned();
    let encoded = serde_json::to_string(&validate_create(overflow).expect_err("overflow money"))
        .expect("serialize overflow error");
    assert!(encoded.contains("excessiveMinWon"));
    assert!(!encoded.contains(rejected));

    for (adequate, excessive) in [(100, 100), (101, 100)] {
        let mut invalid = input();
        invalid.adequate_min_won = adequate.to_string();
        invalid.excessive_min_won = excessive.to_string();
        let AppError::Validation(fields) =
            validate_create(invalid).expect_err("invalid threshold order")
        else {
            panic!("expected threshold validation error");
        };
        assert!(fields.contains_key("excessiveMinWon"));
    }
}

#[test]
fn strict_payloads_require_every_field_and_integer_ages() {
    let complete = || {
        json!({
            "categoryId": CATEGORY_ID,
            "gender": "합성 성별",
            "minAgeYears": 20,
            "maxAgeYears": 29,
            "adequateMinWon": "50",
            "excessiveMinWon": "100"
        })
    };
    let create: CreateCoverageBenchmarkInput =
        serde_json::from_value(complete()).expect("complete create input");
    validate_create(create).expect("valid create input");
    let update: UpdateCoverageBenchmarkInput =
        serde_json::from_value(complete()).expect("complete update input");
    validate_update(update).expect("valid update input");

    for field in [
        "categoryId",
        "gender",
        "minAgeYears",
        "maxAgeYears",
        "adequateMinWon",
        "excessiveMinWon",
    ] {
        let mut missing = complete();
        missing.as_object_mut().expect("object").remove(field);
        assert!(serde_json::from_value::<CreateCoverageBenchmarkInput>(missing).is_err());
    }
    let mut unknown = complete();
    unknown["rogue"] = json!("synthetic-rejected-field-marker");
    assert!(serde_json::from_value::<UpdateCoverageBenchmarkInput>(unknown).is_err());
    let mut fractional = complete();
    fractional["minAgeYears"] = json!(20.5);
    assert!(serde_json::from_value::<CreateCoverageBenchmarkInput>(fractional).is_err());
    let mut string_age = complete();
    string_age["maxAgeYears"] = json!("29");
    assert!(serde_json::from_value::<CreateCoverageBenchmarkInput>(string_age).is_err());

    for lone_surrogate in ["\\uD800", "\\uDC00"] {
        let payload = format!(
            r#"{{"categoryId":"{CATEGORY_ID}","gender":"{lone_surrogate}","minAgeYears":20,"maxAgeYears":29,"adequateMinWon":"50","excessiveMinWon":"100"}}"#
        );
        assert!(serde_json::from_str::<CreateCoverageBenchmarkInput>(&payload).is_err());
    }
}

#[test]
fn validates_canonical_route_and_category_ids_without_echoing_values() {
    let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
    assert_eq!(
        validate_benchmark_id(canonical.to_owned()).expect("canonical benchmark id"),
        canonical
    );

    let rejected = " synthetic-rejected-id-marker ";
    let error = validate_benchmark_id(rejected.to_owned()).expect_err("invalid benchmark id");
    let encoded = serde_json::to_string(&error).expect("serialize id error");
    assert!(encoded.contains("VALIDATION_ERROR"));
    assert!(!encoded.contains(rejected));

    let mut invalid_category = input();
    invalid_category.category_id = rejected.to_owned();
    let encoded =
        serde_json::to_string(&validate_create(invalid_category).expect_err("invalid category id"))
            .expect("serialize category error");
    assert!(encoded.contains("categoryId"));
    assert!(!encoded.contains(rejected));
}
