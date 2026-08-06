use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    cleanup, create_write, seed_customers, set_customer_deleted, temp_path, update_write,
    ConsultationRepository, CUSTOMER_ONE,
};

#[test]
fn inactive_parent_hides_retained_rows_and_blocks_mutations_safely() {
    let path = temp_path("parent-visibility");
    seed_customers(&path);
    let repository = ConsultationRepository::open(&path).expect("consultation repository");
    let consultation = repository
        .create(
            CUSTOMER_ONE,
            create_write("2026-08-06T10:00:00+09:00", Some("합성 보존 기록")),
        )
        .expect("create consultation");

    set_customer_deleted(&path, CUSTOMER_ONE, true);
    assert_eq!(
        repository.list(CUSTOMER_ONE),
        Err(AppError::CustomerNotFound)
    );
    assert_eq!(
        repository.create(
            CUSTOMER_ONE,
            create_write("2026-08-07T10:00:00+09:00", None),
        ),
        Err(AppError::CustomerNotFound)
    );
    assert_eq!(
        repository.update(&consultation.id, update_write("2026-08-07T10:00:00+09:00"),),
        Err(AppError::ConsultationNotFound)
    );
    assert_eq!(
        repository.soft_delete(&consultation.id),
        Err(AppError::ConsultationNotFound)
    );

    let connection = database::open(&path).expect("inspect retained child");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM consultations WHERE id = ?1 AND deleted_at IS NULL",
            params![consultation.id],
            |row| row.get(0),
        )
        .expect("retained consultation row");
    assert_eq!(retained, 1);
    drop(connection);

    set_customer_deleted(&path, CUSTOMER_ONE, false);
    assert_eq!(
        repository
            .list(CUSTOMER_ONE)
            .expect("restored customer visibility")
            .len(),
        1
    );
    drop(repository);
    cleanup(&path);
}

#[test]
fn missing_rows_are_safe_not_found_and_foreign_key_restricts_hard_delete() {
    let path = temp_path("not-found-fk");
    seed_customers(&path);
    let repository = ConsultationRepository::open(&path).expect("consultation repository");
    let consultation = repository
        .create(
            CUSTOMER_ONE,
            create_write("2026-08-06T10:00:00+09:00", None),
        )
        .expect("create consultation");
    let missing = "90000000-0000-4000-8000-000000000099";

    assert_eq!(
        repository.update(missing, update_write("2026-08-07T10:00:00+09:00")),
        Err(AppError::ConsultationNotFound)
    );
    assert_eq!(
        repository.soft_delete(missing),
        Err(AppError::ConsultationNotFound)
    );
    assert_eq!(
        repository.list("90000000-0000-4000-8000-000000000098"),
        Err(AppError::CustomerNotFound)
    );

    let connection = database::open(&path).expect("foreign key database");
    assert!(connection
        .execute("DELETE FROM customers WHERE id = ?1", [CUSTOMER_ONE])
        .is_err());
    let customer_id: String = connection
        .query_row(
            "SELECT customer_id FROM consultations WHERE id = ?1",
            [consultation.id],
            |row| row.get(0),
        )
        .expect("retained FK child");
    assert_eq!(customer_id, CUSTOMER_ONE);
    drop(connection);
    drop(repository);
    cleanup(&path);
}
