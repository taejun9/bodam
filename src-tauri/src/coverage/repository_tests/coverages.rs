use rusqlite::params;

use crate::coverage::model::UpdateCoverageInput;
use crate::coverage::validation::validate_update;
use crate::database;
use crate::error::AppError;

use super::{
    cleanup, seed_customer_and_policies, temp_path, write, CoverageRepository, CATEGORY_ONE,
    CATEGORY_TWO, CUSTOMER_ID, EXCLUDED_POLICY_ID, INCLUDED_POLICY_ID,
};

#[test]
fn creates_lists_updates_and_soft_deletes_with_decimal_string_contract() {
    let path = temp_path("crud");
    seed_customer_and_policies(&path);
    let repository = CoverageRepository::open(&path).expect("coverage repository");
    let included = repository
        .create(
            CUSTOMER_ID,
            INCLUDED_POLICY_ID,
            write(CATEGORY_ONE, "9223372036854775807"),
        )
        .expect("create maximum coverage");
    let excluded = repository
        .create(CUSTOMER_ID, EXCLUDED_POLICY_ID, write(CATEGORY_ONE, "0"))
        .expect("create excluded-policy coverage");
    let duplicate = repository
        .create(CUSTOMER_ID, INCLUDED_POLICY_ID, write(CATEGORY_ONE, "1"))
        .expect("create duplicate category coverage");

    let listed = repository.list(CUSTOMER_ID).expect("active coverages");
    assert_eq!(
        listed.len(),
        3,
        "excluded policy coverage remains manageable"
    );
    assert!(listed.iter().any(|coverage| coverage.id == excluded.id));
    assert_eq!(included.amount_won, i64::MAX.to_string());
    let payload = serde_json::to_value(&included).expect("serialize coverage");
    assert_eq!(payload["amountWon"], "9223372036854775807");
    assert_eq!(payload["policyId"], INCLUDED_POLICY_ID);
    assert_eq!(payload["categoryId"], CATEGORY_ONE);

    let updated = repository
        .update(
            CUSTOMER_ID,
            &included.id,
            validate_update(UpdateCoverageInput {
                category_id: CATEGORY_TWO.to_owned(),
                amount_won: "25".to_owned(),
            })
            .expect("valid coverage update"),
        )
        .expect("update coverage");
    assert_eq!(updated.policy_id, INCLUDED_POLICY_ID);
    assert_eq!(updated.category_id, CATEGORY_TWO);
    assert_eq!(updated.amount_won, "25");

    repository
        .soft_delete(CUSTOMER_ID, &duplicate.id)
        .expect("soft delete coverage");
    assert_eq!(
        repository.list(CUSTOMER_ID).expect("after deletion").len(),
        2
    );
    assert_eq!(
        repository.soft_delete(CUSTOMER_ID, &duplicate.id),
        Err(AppError::CoverageNotFound)
    );
    drop(repository);

    let connection = database::open(&path).expect("inspect retained row");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverages WHERE id = ?1 AND deleted_at IS NOT NULL",
            params![duplicate.id],
            |row| row.get(0),
        )
        .expect("retained soft-deleted coverage");
    assert_eq!(retained, 1);
    drop(connection);

    let reopened = CoverageRepository::open(&path).expect("reopen coverage repository");
    assert_eq!(reopened.list(CUSTOMER_ID).expect("persisted list").len(), 2);
    drop(reopened);
    cleanup(&path);
}
