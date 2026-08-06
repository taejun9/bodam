use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    cleanup, seed_customer_and_policies, set_category_deleted, set_customer_deleted,
    set_policy_deleted, temp_path, write, CoverageRepository, CATEGORY_ONE, CATEGORY_TWO,
    CUSTOMER_ID, INCLUDED_POLICY_ID, OTHER_CUSTOMER_ID,
};

#[test]
fn active_parent_rules_hide_and_restore_retained_coverage_rows() {
    let path = temp_path("parent-visibility");
    seed_customer_and_policies(&path);
    let repository = CoverageRepository::open(&path).expect("coverage repository");
    let coverage = repository
        .create(CUSTOMER_ID, INCLUDED_POLICY_ID, write(CATEGORY_ONE, "5000"))
        .expect("create coverage");

    set_category_deleted(&path, CATEGORY_ONE, true);
    assert!(repository
        .list(CUSTOMER_ID)
        .expect("hidden by category")
        .is_empty());
    assert_eq!(
        repository.update(CUSTOMER_ID, &coverage.id, write(CATEGORY_TWO, "1")),
        Err(AppError::CoverageNotFound)
    );
    set_category_deleted(&path, CATEGORY_ONE, false);
    assert_eq!(
        repository
            .list(CUSTOMER_ID)
            .expect("category restored")
            .len(),
        1
    );

    set_policy_deleted(&path, INCLUDED_POLICY_ID, true);
    assert!(repository
        .list(CUSTOMER_ID)
        .expect("hidden by policy")
        .is_empty());
    assert_eq!(
        repository.create(CUSTOMER_ID, INCLUDED_POLICY_ID, write(CATEGORY_ONE, "1")),
        Err(AppError::InsurancePolicyNotFound)
    );
    set_policy_deleted(&path, INCLUDED_POLICY_ID, false);
    assert_eq!(
        repository.list(CUSTOMER_ID).expect("policy restored").len(),
        1
    );

    set_customer_deleted(&path, CUSTOMER_ID, true);
    assert_eq!(
        repository.list(CUSTOMER_ID),
        Err(AppError::CustomerNotFound)
    );
    set_customer_deleted(&path, CUSTOMER_ID, false);
    assert_eq!(
        repository
            .list(CUSTOMER_ID)
            .expect("customer restored")
            .len(),
        1
    );

    assert_eq!(
        repository.create(
            OTHER_CUSTOMER_ID,
            INCLUDED_POLICY_ID,
            write(CATEGORY_ONE, "1")
        ),
        Err(AppError::InsurancePolicyNotFound)
    );
    assert_eq!(
        repository.create(
            CUSTOMER_ID,
            INCLUDED_POLICY_ID,
            write("10000000-0000-4000-8000-000000000099", "1")
        ),
        Err(AppError::CoverageCategoryNotFound)
    );

    let connection = database::open(&path).expect("inspect foreign keys");
    assert!(connection
        .execute(
            "DELETE FROM insurance_policies WHERE id = ?1",
            [INCLUDED_POLICY_ID]
        )
        .is_err());
    assert!(connection
        .execute(
            "DELETE FROM coverage_categories WHERE id = ?1",
            [CATEGORY_ONE]
        )
        .is_err());
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverages WHERE id = ?1 AND deleted_at IS NULL",
            params![coverage.id],
            |row| row.get(0),
        )
        .expect("retained active child");
    assert_eq!(retained, 1);
    drop(connection);
    drop(repository);
    cleanup(&path);
}
