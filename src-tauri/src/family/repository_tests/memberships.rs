use crate::error::AppError;

use super::{
    cleanup, create_family, membership_write, seed_customers, temp_path, FamilyRepository,
    CUSTOMER_ONE, CUSTOMER_TWO,
};

#[test]
fn memberships_are_ordered_scoped_and_update_only_relationship() {
    let path = temp_path("membership-lifecycle");
    seed_customers(&path);
    let repository = FamilyRepository::open(&path).expect("family repository");
    let family = create_family(&repository, "합성 가족 하나");
    let other = create_family(&repository, "합성 가족 둘");
    let first = repository
        .add_membership(&family.id, membership_write(CUSTOMER_ONE, Some(" 보호자 ")))
        .expect("add first membership");
    let second = repository
        .add_membership(&family.id, membership_write(CUSTOMER_TWO, None))
        .expect("add second membership");

    let listed = repository
        .list_memberships(&family.id)
        .expect("list memberships");
    assert_eq!(
        listed
            .iter()
            .map(|row| row.customer_id.as_str())
            .collect::<Vec<_>>(),
        [CUSTOMER_TWO, CUSTOMER_ONE]
    );
    assert_eq!(first.relationship_name.as_deref(), Some("보호자"));
    assert_eq!(second.relationship_name, None);

    assert_eq!(
        repository.add_membership(&family.id, membership_write(CUSTOMER_ONE, Some("중복"))),
        Err(AppError::FamilyMembershipConflict)
    );
    let updated = repository
        .update_membership(&family.id, &first.id, Some("관계 수정".to_owned()))
        .expect("update relationship");
    assert_eq!(updated.relationship_name.as_deref(), Some("관계 수정"));
    assert_eq!(updated.customer_id, CUSTOMER_ONE);
    assert_eq!(
        repository.update_membership(&other.id, &first.id, None),
        Err(AppError::FamilyMembershipNotFound)
    );

    repository
        .add_membership(&other.id, membership_write(CUSTOMER_ONE, None))
        .expect("same customer in another family");
    assert_eq!(
        repository
            .list_memberships(&other.id)
            .expect("other family")
            .len(),
        1
    );
    drop(repository);
    cleanup(&path);
}

#[test]
fn readding_a_soft_deleted_pair_reuses_id_and_replaces_relationship() {
    let path = temp_path("membership-reactivation");
    seed_customers(&path);
    let repository = FamilyRepository::open(&path).expect("family repository");
    let family = create_family(&repository, "합성 재등록 가족");
    let original = repository
        .add_membership(
            &family.id,
            membership_write(CUSTOMER_ONE, Some("이전 관계")),
        )
        .expect("add membership");
    repository
        .soft_delete_membership(&family.id, &original.id)
        .expect("soft delete membership");
    assert!(repository
        .list_memberships(&family.id)
        .expect("hidden row")
        .is_empty());

    let restored = repository
        .add_membership(&family.id, membership_write(CUSTOMER_ONE, Some("새 관계")))
        .expect("reactivate membership");
    assert_eq!(restored.id, original.id);
    assert_eq!(restored.created_at, original.created_at);
    assert_eq!(restored.relationship_name.as_deref(), Some("새 관계"));
    assert_eq!(
        repository
            .list_memberships(&family.id)
            .expect("one row")
            .len(),
        1
    );
    drop(repository);
    cleanup(&path);
}
