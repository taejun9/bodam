use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    cleanup, create_family, membership_write, seed_customers, set_deleted, temp_path,
    FamilyRepository, CUSTOMER_ONE, CUSTOMER_TWO,
};

#[test]
fn inactive_parents_hide_retained_memberships_and_block_mutation() {
    let path = temp_path("parent-visibility");
    seed_customers(&path);
    let repository = FamilyRepository::open(&path).expect("family repository");
    let family = create_family(&repository, "합성 가시성 가족");
    let membership = repository
        .add_membership(&family.id, membership_write(CUSTOMER_ONE, None))
        .expect("add membership");

    set_deleted(&path, "customers", CUSTOMER_ONE, true);
    assert!(repository
        .list_memberships(&family.id)
        .expect("hidden customer")
        .is_empty());
    assert_eq!(
        repository.update_membership(&family.id, &membership.id, Some("수정".to_owned())),
        Err(AppError::FamilyMembershipNotFound)
    );
    assert_eq!(
        repository.soft_delete_membership(&family.id, &membership.id),
        Err(AppError::FamilyMembershipNotFound)
    );
    assert_eq!(
        repository.add_membership(&family.id, membership_write(CUSTOMER_ONE, None)),
        Err(AppError::CustomerNotFound)
    );
    set_deleted(&path, "customers", CUSTOMER_ONE, false);
    assert_eq!(
        repository
            .list_memberships(&family.id)
            .expect("restored customer")
            .len(),
        1
    );

    set_deleted(&path, "families", &family.id, true);
    assert_eq!(
        repository.list_memberships(&family.id),
        Err(AppError::FamilyNotFound)
    );
    assert_eq!(
        repository.add_membership(&family.id, membership_write(CUSTOMER_TWO, None)),
        Err(AppError::FamilyNotFound)
    );
    let connection = database::open(&path).expect("inspect retained membership");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM family_memberships
             WHERE id = ?1 AND deleted_at IS NULL",
            params![membership.id],
            |row| row.get(0),
        )
        .expect("retained child row");
    assert_eq!(retained, 1);
    drop(connection);
    drop(repository);
    cleanup(&path);
}

#[test]
fn membership_deletion_survives_parent_visibility_changes_and_foreign_keys_restrict() {
    let path = temp_path("retained-deletion");
    seed_customers(&path);
    let repository = FamilyRepository::open(&path).expect("family repository");
    let family = create_family(&repository, "합성 보존 가족");
    let membership = repository
        .add_membership(&family.id, membership_write(CUSTOMER_ONE, None))
        .expect("add membership");
    repository
        .soft_delete_membership(&family.id, &membership.id)
        .expect("soft delete membership");
    set_deleted(&path, "customers", CUSTOMER_ONE, true);
    set_deleted(&path, "customers", CUSTOMER_ONE, false);
    assert!(repository
        .list_memberships(&family.id)
        .expect("membership stays hidden")
        .is_empty());

    let connection = database::open(&path).expect("foreign key database");
    for (table, id) in [
        ("families", family.id.as_str()),
        ("customers", CUSTOMER_ONE),
    ] {
        assert!(connection
            .execute(&format!("DELETE FROM {table} WHERE id = ?1"), [id])
            .is_err());
    }
    let retained: (bool, String) = connection
        .query_row(
            "SELECT deleted_at IS NOT NULL, customer_id
             FROM family_memberships WHERE id = ?1",
            [membership.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("retained soft-deleted membership");
    assert_eq!(retained, (true, CUSTOMER_ONE.to_owned()));
    drop(connection);
    drop(repository);
    cleanup(&path);
}
