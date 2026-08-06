use serde_json::json;

use crate::error::AppError;

use super::model::{CreateCoverageInput, UpdateCoverageCategoryInput, UpdateCoverageInput};
use super::validation::{
    validate_category_id, validate_category_update, validate_coverage_id, validate_create,
    validate_customer_id, validate_policy_id, validate_update, MAX_CATEGORY_NAME_CHARS,
};

const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";

fn input(amount: &str) -> CreateCoverageInput {
    CreateCoverageInput {
        category_id: CATEGORY_ID.to_owned(),
        amount_won: amount.to_owned(),
    }
}

#[test]
fn validates_category_names_by_unicode_scalar_count() {
    assert_eq!(
        validate_category_update(UpdateCoverageCategoryInput {
            name: "  합성 보장  ".to_owned(),
        }),
        Ok("합성 보장".to_owned())
    );
    validate_category_update(UpdateCoverageCategoryInput {
        name: "가".repeat(MAX_CATEGORY_NAME_CHARS),
    })
    .expect("maximum category name");

    for invalid in [" ".to_owned(), "나".repeat(MAX_CATEGORY_NAME_CHARS + 1)] {
        let error = validate_category_update(UpdateCoverageCategoryInput { name: invalid })
            .expect_err("invalid category name");
        let encoded = serde_json::to_string(&error).expect("serialize validation error");
        assert!(encoded.contains("VALIDATION_ERROR"));
    }
    let rejected = "synthetic-rejected-category-name-marker".repeat(4);
    let error = validate_category_update(UpdateCoverageCategoryInput {
        name: rejected.clone(),
    })
    .expect_err("oversized marker");
    assert!(!serde_json::to_string(&error)
        .expect("serialize marker error")
        .contains(&rejected));
}

#[test]
fn validates_canonical_decimal_money_without_float_conversion() {
    assert_eq!(validate_create(input("0")).expect("zero").amount_won, 0);
    assert_eq!(
        validate_create(input("9223372036854775807"))
            .expect("i64 maximum")
            .amount_won,
        i64::MAX
    );

    for invalid in ["", "-1", "1.0", " 1", "1 ", "+1", "01", "９"] {
        let error = validate_create(input(invalid)).expect_err("invalid amount");
        let encoded = serde_json::to_string(&error).expect("serialize validation error");
        assert!(encoded.contains("amountWon"));
    }

    let rejected = "synthetic-rejected-money-marker";
    let error = validate_create(input(rejected)).expect_err("rejected marker");
    assert!(!serde_json::to_string(&error)
        .expect("serialize marker error")
        .contains(rejected));

    let AppError::Validation(fields) =
        validate_create(input("9223372036854775808")).expect_err("overflow amount")
    else {
        panic!("expected overflow validation error");
    };
    assert_eq!(
        fields.get("amountWon").map(String::as_str),
        Some("보장금액이 저장 가능한 범위를 넘었습니다.")
    );
}

#[test]
fn rejects_invalid_category_ids_without_echoing_values() {
    let invalid = "synthetic-rejected-category-marker";
    let error = validate_create(CreateCoverageInput {
        category_id: invalid.to_owned(),
        amount_won: "1".to_owned(),
    })
    .expect_err("invalid category id");
    let encoded = serde_json::to_string(&error).expect("serialize validation error");
    assert!(encoded.contains("categoryId"));
    assert!(!encoded.contains(invalid));
}

#[test]
fn strict_ipc_payloads_reject_unknown_and_missing_fields() {
    let create = || json!({ "categoryId": CATEGORY_ID, "amountWon": "10" });
    let update = || json!({ "categoryId": CATEGORY_ID, "amountWon": "20" });
    validate_create(serde_json::from_value(create()).expect("complete create"))
        .expect("valid create");
    validate_update(serde_json::from_value(update()).expect("complete update"))
        .expect("valid update");

    for field in ["categoryId", "amountWon"] {
        let mut missing_create = create();
        missing_create
            .as_object_mut()
            .expect("object")
            .remove(field);
        assert!(serde_json::from_value::<CreateCoverageInput>(missing_create).is_err());

        let mut missing_update = update();
        missing_update
            .as_object_mut()
            .expect("object")
            .remove(field);
        assert!(serde_json::from_value::<UpdateCoverageInput>(missing_update).is_err());
    }
    let mut unknown = update();
    unknown["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<UpdateCoverageInput>(unknown).is_err());
    let mut unknown_create = create();
    unknown_create["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<CreateCoverageInput>(unknown_create).is_err());
    assert!(serde_json::from_value::<UpdateCoverageCategoryInput>(json!({})).is_err());
    assert!(
        serde_json::from_value::<UpdateCoverageCategoryInput>(json!({
            "name": "합성 카테고리",
            "rogue": "synthetic-marker"
        }))
        .is_err()
    );
}

#[test]
fn validates_all_route_ids_as_canonical_uuids() {
    let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
    for validate in [
        validate_customer_id,
        validate_policy_id,
        validate_category_id,
        validate_coverage_id,
    ] {
        assert_eq!(
            validate(canonical.to_owned()).expect("canonical UUID"),
            canonical
        );
        let invalid = " FEF9EFC5-74C7-485A-B0D5-6BB8A3FF02C8 ";
        let error = validate(invalid.to_owned()).expect_err("noncanonical UUID");
        let encoded = serde_json::to_string(&error).expect("serialize validation error");
        assert!(encoded.contains("VALIDATION_ERROR"));
        assert!(!encoded.contains(invalid));
    }
}

#[test]
fn validation_errors_use_safe_codes() {
    let AppError::Validation(fields) = validate_create(input("-5")).expect_err("invalid money")
    else {
        panic!("expected validation error");
    };
    assert_eq!(fields.len(), 1);
    assert!(fields.contains_key("amountWon"));
}
