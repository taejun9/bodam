use serde_json::json;

use crate::error::AppError;

use super::model::{
    AddFamilyMembershipInput, CreateFamilyInput, UpdateFamilyInput, UpdateFamilyMembershipInput,
};
use super::validation::{
    validate_add, validate_create, validate_family_id, validate_membership_id,
    validate_membership_update, validate_parent_family_id, validate_search, validate_update,
    MAX_FAMILY_TEXT_CHARS,
};

const CANONICAL_ID: &str = "20000000-0000-4000-8000-000000000001";

#[test]
fn trims_and_bounds_family_names_by_unicode_scalar_count() {
    assert_eq!(
        validate_create(CreateFamilyInput {
            name: "  합성 가족  ".to_owned(),
        }),
        Ok("합성 가족".to_owned())
    );
    assert!(validate_update(UpdateFamilyInput {
        name: "가".repeat(MAX_FAMILY_TEXT_CHARS),
    })
    .is_ok());
    let blank = validate_create(CreateFamilyInput {
        name: " ".to_owned(),
    })
    .expect_err("blank family name");
    let AppError::Validation(fields) = blank else {
        panic!("expected validation error");
    };
    assert!(fields.contains_key("name"));

    let rejected = "나".repeat(MAX_FAMILY_TEXT_CHARS + 1);
    let error = validate_create(CreateFamilyInput {
        name: rejected.clone(),
    })
    .expect_err("oversized family name");
    assert_safe_validation_error(error, &rejected, "name");
}

#[test]
fn normalizes_and_bounds_relationship_names() {
    let blank = validate_membership_update(UpdateFamilyMembershipInput {
        relationship_name: Some("   ".to_owned()),
    })
    .expect("blank relationship is null");
    assert_eq!(blank, None);

    let exact = "관".repeat(MAX_FAMILY_TEXT_CHARS);
    assert_eq!(
        validate_membership_update(UpdateFamilyMembershipInput {
            relationship_name: Some(format!(" {exact} ")),
        })
        .expect("bounded relationship"),
        Some(exact)
    );

    let rejected = "계".repeat(MAX_FAMILY_TEXT_CHARS + 1);
    let error = validate_membership_update(UpdateFamilyMembershipInput {
        relationship_name: Some(rejected.clone()),
    })
    .expect_err("oversized relationship");
    assert_safe_validation_error(error, &rejected, "relationshipName");
}

#[test]
fn validates_every_id_as_a_canonical_uuid_without_echoing_values() {
    assert_eq!(
        validate_family_id(CANONICAL_ID.to_owned()).expect("family id"),
        CANONICAL_ID
    );
    assert_eq!(
        validate_parent_family_id(CANONICAL_ID.to_owned()).expect("parent family id"),
        CANONICAL_ID
    );
    assert_eq!(
        validate_membership_id(CANONICAL_ID.to_owned()).expect("membership id"),
        CANONICAL_ID
    );

    for invalid in [
        "20000000-0000-4000-8000-000000000001 ",
        "20000000000040008000000000000001",
        "SYNTHETIC-REJECTED-ID-MARKER",
    ] {
        for error in [
            validate_family_id(invalid.to_owned()).expect_err("family UUID"),
            validate_parent_family_id(invalid.to_owned()).expect_err("parent UUID"),
            validate_membership_id(invalid.to_owned()).expect_err("membership UUID"),
        ] {
            assert_safe_validation_error(error, invalid, "");
        }
    }
}

#[test]
fn add_validates_customer_id_and_relationship_together() {
    let marker = "synthetic-rejected-customer-id-marker";
    let error = validate_add(AddFamilyMembershipInput {
        customer_id: marker.to_owned(),
        relationship_name: Some("관".repeat(MAX_FAMILY_TEXT_CHARS + 1)),
    })
    .expect_err("invalid membership input");
    let AppError::Validation(fields) = &error else {
        panic!("expected validation error");
    };
    assert_eq!(fields.len(), 2);
    assert!(fields.contains_key("customerId"));
    assert!(fields.contains_key("relationshipName"));
    assert!(!serde_json::to_string(&error)
        .expect("error JSON")
        .contains(marker));
}

#[test]
fn normalizes_and_bounds_optional_search() {
    assert_eq!(validate_search(Some("   ".to_owned())), Ok(None));
    assert_eq!(
        validate_search(Some("  합성  ".to_owned())),
        Ok(Some("합성".to_owned()))
    );
    assert!(validate_search(Some("가".repeat(MAX_FAMILY_TEXT_CHARS))).is_ok());
    let rejected = "나".repeat(MAX_FAMILY_TEXT_CHARS + 1);
    let error = validate_search(Some(rejected.clone())).expect_err("oversized search");
    assert_safe_validation_error(error, &rejected, "search");
}

#[test]
fn ipc_inputs_reject_missing_and_unknown_fields() {
    assert!(serde_json::from_value::<CreateFamilyInput>(json!({})).is_err());
    assert!(serde_json::from_value::<CreateFamilyInput>(json!({
        "name": "합성", "rogue": true
    }))
    .is_err());
    assert!(serde_json::from_value::<UpdateFamilyInput>(json!({})).is_err());

    let add = json!({"customerId": CANONICAL_ID, "relationshipName": null});
    serde_json::from_value::<AddFamilyMembershipInput>(add.clone()).expect("complete add");
    for field in ["customerId", "relationshipName"] {
        let mut missing = add.clone();
        missing.as_object_mut().expect("object").remove(field);
        assert!(serde_json::from_value::<AddFamilyMembershipInput>(missing).is_err());
    }
    assert!(serde_json::from_value::<AddFamilyMembershipInput>(json!({
        "customerId": CANONICAL_ID,
        "relationshipName": null,
        "rogue": true
    }))
    .is_err());

    serde_json::from_value::<UpdateFamilyMembershipInput>(json!({"relationshipName": null}))
        .expect("explicit null update");
    assert!(serde_json::from_value::<UpdateFamilyMembershipInput>(json!({})).is_err());
    assert!(
        serde_json::from_value::<UpdateFamilyMembershipInput>(json!({
            "relationshipName": null, "rogue": true
        }))
        .is_err()
    );
}

fn assert_safe_validation_error(error: AppError, rejected: &str, field: &str) {
    let AppError::Validation(fields) = &error else {
        panic!("expected validation error");
    };
    if !field.is_empty() {
        assert!(fields.contains_key(field));
    }
    let encoded = serde_json::to_string(&error).expect("serialize validation error");
    assert!(encoded.contains("VALIDATION_ERROR"));
    assert!(!encoded.contains(rejected));
}
