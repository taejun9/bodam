use serde_json::json;

use crate::error::AppError;

use super::model::{CreateInsurancePolicyInput, UpdateInsurancePolicyInput};
use super::validation::{
    validate_create, validate_customer_id, validate_policy_id, validate_update, MAX_TEXT_CHARS,
};

fn create_input(money: &str) -> CreateInsurancePolicyInput {
    CreateInsurancePolicyInput {
        insurer: "  합성보험사  ".to_owned(),
        product_name: "  합성상품  ".to_owned(),
        joined_on: Some(" 2024-02-29 ".to_owned()),
        coverage_term: Some(" 종신 ".to_owned()),
        payment_term: Some(" 20년 ".to_owned()),
        monthly_premium_won: money.to_owned(),
        disclosure_plan: Some(" 합성고지 ".to_owned()),
        matures_on: None,
        renewable: false,
        status: Some(" 유지 ".to_owned()),
        is_included: true,
    }
}

#[test]
fn validates_and_normalizes_policy_input_without_float_conversion() {
    let write = validate_create(create_input("9223372036854775807")).expect("valid policy");
    assert_eq!(write.insurer, "합성보험사");
    assert_eq!(write.product_name, "합성상품");
    assert_eq!(write.joined_on.as_deref(), Some("2024-02-29"));
    assert_eq!(write.coverage_term.as_deref(), Some("종신"));
    assert_eq!(write.monthly_premium_won, i64::MAX);

    assert_eq!(
        validate_create(create_input("0"))
            .expect("zero is valid")
            .monthly_premium_won,
        0
    );
}

#[test]
fn rejects_noncanonical_or_out_of_range_money_and_invalid_dates() {
    for invalid in [
        "-1",
        "1.0",
        " 1",
        "1 ",
        "+1",
        "01",
        "９",
        "9223372036854775808",
    ] {
        let error = validate_create(create_input(invalid)).expect_err("invalid money");
        let encoded = serde_json::to_string(&error).expect("serialize error");
        assert!(encoded.contains("monthlyPremiumWon"));
        assert!(!encoded.contains(invalid));
    }

    let mut input = create_input("1");
    input.joined_on = Some("2023-02-29".to_owned());
    input.matures_on = Some("2025/01/01".to_owned());
    let AppError::Validation(fields) = validate_create(input).expect_err("invalid dates") else {
        panic!("expected validation error");
    };
    assert!(fields.contains_key("joinedOn"));
    assert!(fields.contains_key("maturesOn"));
}

#[test]
fn bounds_unicode_text_and_rejects_blank_required_text() {
    let mut accepted = create_input("1");
    accepted.insurer = "가".repeat(MAX_TEXT_CHARS);
    validate_create(accepted).expect("maximum Unicode text length");

    let mut rejected = create_input("1");
    rejected.insurer = " ".to_owned();
    rejected.status = Some("나".repeat(MAX_TEXT_CHARS + 1));
    let AppError::Validation(fields) = validate_create(rejected).expect_err("invalid text") else {
        panic!("expected validation error");
    };
    assert!(fields.contains_key("insurer"));
    assert!(fields.contains_key("status"));
}

#[test]
fn serde_contract_is_strict_and_update_requires_explicit_nullable_fields() {
    let minimal: CreateInsurancePolicyInput = serde_json::from_value(json!({
        "insurer": "합성보험사",
        "productName": "합성상품",
        "monthlyPremiumWon": "0"
    }))
    .expect("create defaults");
    assert!(!minimal.renewable);
    assert!(minimal.is_included);

    let complete = || {
        json!({
            "insurer": "합성보험사",
            "productName": "합성상품",
            "joinedOn": null,
            "coverageTerm": null,
            "paymentTerm": null,
            "monthlyPremiumWon": "1000",
            "disclosurePlan": null,
            "maturesOn": null,
            "renewable": false,
            "status": null,
            "isIncluded": true
        })
    };
    let parsed: UpdateInsurancePolicyInput =
        serde_json::from_value(complete()).expect("complete update");
    validate_update(parsed).expect("valid update");

    for field in [
        "insurer",
        "productName",
        "joinedOn",
        "coverageTerm",
        "paymentTerm",
        "monthlyPremiumWon",
        "disclosurePlan",
        "maturesOn",
        "renewable",
        "status",
        "isIncluded",
    ] {
        let mut missing = complete();
        missing.as_object_mut().expect("object").remove(field);
        assert!(
            serde_json::from_value::<UpdateInsurancePolicyInput>(missing).is_err(),
            "missing {field} must fail"
        );
    }
    let mut unknown = complete();
    unknown["rogue"] = json!("synthetic-marker");
    assert!(serde_json::from_value::<UpdateInsurancePolicyInput>(unknown).is_err());
}

#[test]
fn validates_canonical_ids_without_echoing_rejected_values() {
    let canonical = "fef9efc5-74c7-485a-b0d5-6bb8a3ff02c8";
    assert_eq!(
        validate_customer_id(canonical.to_owned()).expect("customer UUID"),
        canonical
    );
    assert_eq!(
        validate_policy_id(canonical.to_owned()).expect("policy UUID"),
        canonical
    );

    for invalid in [
        "FEF9EFC5-74C7-485A-B0D5-6BB8A3FF02C8",
        "fef9efc574c7485ab0d56bb8a3ff02c8",
        " synthetic-rejected-id-marker ",
    ] {
        let error = validate_policy_id(invalid.to_owned()).expect_err("invalid UUID");
        let encoded = serde_json::to_string(&error).expect("serialize error");
        assert!(encoded.contains("VALIDATION_ERROR"));
        assert!(!encoded.contains(invalid));
    }
}
