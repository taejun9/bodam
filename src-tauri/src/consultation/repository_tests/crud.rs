use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    cleanup, create_write, seed_customers, temp_path, update_write, ConsultationRepository,
    CUSTOMER_ONE, CUSTOMER_TWO,
};

#[test]
fn creates_duplicate_instants_lists_stably_updates_and_soft_deletes() {
    let path = temp_path("crud");
    seed_customers(&path);
    let repository = ConsultationRepository::open(&path).expect("consultation repository");
    let older = repository
        .create(
            CUSTOMER_ONE,
            create_write("2026-08-05T18:00:00+09:00", None),
        )
        .expect("create older consultation");
    let duplicate_one = repository
        .create(
            CUSTOMER_ONE,
            create_write("2026-08-06T18:00:00+09:00", Some("합성 중복 기록 A")),
        )
        .expect("create first duplicate instant");
    let duplicate_two = repository
        .create(
            CUSTOMER_ONE,
            create_write("2026-08-06T09:00:00Z", Some("합성 중복 기록 B")),
        )
        .expect("create second duplicate instant");

    let listed = repository.list(CUSTOMER_ONE).expect("list consultations");
    let mut duplicate_ids = [duplicate_one.id.clone(), duplicate_two.id.clone()];
    duplicate_ids.sort();
    assert_eq!(listed.len(), 3);
    assert_eq!(listed[0].id, duplicate_ids[0]);
    assert_eq!(listed[1].id, duplicate_ids[1]);
    assert_eq!(listed[2].id, older.id);
    assert_eq!(listed[0].consulted_at, "2026-08-06T09:00:00.000Z");

    let updated = repository
        .update(&older.id, update_write("2026-08-07T09:30:00+09:00"))
        .expect("update consultation");
    assert_eq!(updated.customer_id, CUSTOMER_ONE);
    assert_eq!(updated.consulted_at, "2026-08-07T00:30:00.000Z");
    assert_eq!(updated.content.as_deref(), Some("합성 수정 기록"));
    assert_eq!(updated.next_contact_on, None);
    assert_eq!(updated.result.as_deref(), Some("합성 수정 결과"));

    repository
        .soft_delete(&duplicate_one.id)
        .expect("soft delete consultation");
    assert_eq!(repository.list(CUSTOMER_ONE).expect("active list").len(), 2);
    assert_eq!(
        repository.soft_delete(&duplicate_one.id),
        Err(AppError::ConsultationNotFound)
    );

    drop(repository);
    let connection = database::open(&path).expect("inspect persisted consultation");
    let retained: (String, bool) = connection
        .query_row(
            "SELECT customer_id, deleted_at IS NOT NULL FROM consultations WHERE id = ?1",
            params![duplicate_one.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("soft-deleted row");
    assert_eq!(retained, (CUSTOMER_ONE.to_owned(), true));
    drop(connection);
    cleanup(&path);
}

#[test]
fn persists_utc_contract_across_reopen_and_keeps_customers_separate() {
    let path = temp_path("persistence");
    seed_customers(&path);
    let consultation_id = {
        let repository = ConsultationRepository::open(&path).expect("first repository");
        let created = repository
            .create(
                CUSTOMER_TWO,
                create_write("2026-08-06T23:59:59.987654+09:00", None),
            )
            .expect("create persisted consultation");
        assert!(repository
            .list(CUSTOMER_ONE)
            .expect("other customer list")
            .is_empty());
        created.id
    };

    let reopened = ConsultationRepository::open(&path).expect("reopen repository");
    let consultation = reopened
        .list(CUSTOMER_TWO)
        .expect("list persisted consultation")
        .pop()
        .expect("persisted consultation");
    assert_eq!(consultation.id, consultation_id);
    assert_eq!(consultation.consulted_at, "2026-08-06T14:59:59.987Z");
    let payload = serde_json::to_value(consultation).expect("serialize IPC consultation");
    assert_eq!(payload["customerId"], CUSTOMER_TWO);
    assert_eq!(payload["consultedAt"], "2026-08-06T14:59:59.987Z");
    assert!(payload.get("deletedAt").is_none());
    drop(reopened);
    cleanup(&path);
}
