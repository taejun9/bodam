use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    august_range, cleanup, create_write, seed_customers, set_customer_deleted, temp_path,
    update_write, ScheduleRepository, CUSTOMER_ONE, CUSTOMER_TWO,
};

#[test]
fn inactive_parent_hides_linked_rows_but_keeps_unlinked_rows_visible() {
    let path = temp_path("parent-visibility");
    seed_customers(&path);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let linked = repository
        .create(create_write(
            "합성 연결 일정",
            "2026-08-06",
            None,
            Some(CUSTOMER_ONE),
        ))
        .expect("create linked schedule");
    let unlinked = repository
        .create(create_write("합성 독립 일정", "2026-08-06", None, None))
        .expect("create unlinked schedule");

    set_customer_deleted(&path, CUSTOMER_ONE, true);
    let visible = repository
        .list(&august_range())
        .expect("list visible schedules");
    assert_eq!(visible.len(), 1);
    assert_eq!(visible[0].id, unlinked.id);
    assert_eq!(
        repository.set_completed(&linked.id, true),
        Err(AppError::ScheduleNotFound)
    );
    assert_eq!(
        repository.update(&linked.id, update_write(None)),
        Err(AppError::ScheduleNotFound)
    );
    assert_eq!(
        repository.soft_delete(&linked.id),
        Err(AppError::ScheduleNotFound)
    );

    let connection = database::open(&path).expect("inspect retained linked schedule");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM schedules WHERE id = ?1 AND deleted_at IS NULL",
            [linked.id.as_str()],
            |row| row.get(0),
        )
        .expect("retained linked schedule");
    assert_eq!(retained, 1);
    drop(connection);

    set_customer_deleted(&path, CUSTOMER_ONE, false);
    assert_eq!(
        repository
            .list(&august_range())
            .expect("restored visibility")
            .len(),
        2
    );
    drop(repository);
    cleanup(&path);
}

#[test]
fn missing_or_inactive_customer_blocks_create_and_relink_without_partial_write() {
    let path = temp_path("customer-guard");
    seed_customers(&path);
    set_customer_deleted(&path, CUSTOMER_TWO, true);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let missing = "20000000-0000-4000-8000-000000000099";

    assert_eq!(
        repository.create(create_write(
            "합성 누락 고객 일정",
            "2026-08-06",
            None,
            Some(missing),
        )),
        Err(AppError::CustomerNotFound)
    );
    assert_eq!(
        repository.create(create_write(
            "합성 삭제 고객 일정",
            "2026-08-06",
            None,
            Some(CUSTOMER_TWO),
        )),
        Err(AppError::CustomerNotFound)
    );
    let unlinked = repository
        .create(create_write("합성 원본 일정", "2026-08-06", None, None))
        .expect("create unlinked schedule");
    assert_eq!(
        repository.update(&unlinked.id, update_write(Some(CUSTOMER_TWO))),
        Err(AppError::CustomerNotFound)
    );
    let unchanged = repository.list(&august_range()).expect("unchanged list");
    assert_eq!(unchanged.len(), 1);
    assert_eq!(unchanged[0].title, "합성 원본 일정");
    assert_eq!(unchanged[0].customer_id, None);
    assert!(!unchanged[0].is_completed);
    drop(repository);
    cleanup(&path);
}

#[test]
fn missing_rows_are_safe_and_foreign_key_restricts_delete_and_cascades_key_update() {
    let path = temp_path("not-found-fk");
    seed_customers(&path);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let schedule = repository
        .create(create_write(
            "합성 FK 일정",
            "2026-08-06",
            None,
            Some(CUSTOMER_ONE),
        ))
        .expect("create linked schedule");
    let missing = "90000000-0000-4000-8000-000000000099";
    assert_eq!(
        repository.update(missing, update_write(None)),
        Err(AppError::ScheduleNotFound)
    );
    assert_eq!(
        repository.set_completed(missing, true),
        Err(AppError::ScheduleNotFound)
    );
    assert_eq!(
        repository.soft_delete(missing),
        Err(AppError::ScheduleNotFound)
    );

    let connection = database::open(&path).expect("foreign key database");
    assert!(connection
        .execute("DELETE FROM customers WHERE id = ?1", [CUSTOMER_ONE])
        .is_err());
    let replacement = "20000000-0000-4000-8000-000000000010";
    connection
        .execute(
            "UPDATE customers SET id = ?2 WHERE id = ?1",
            params![CUSTOMER_ONE, replacement],
        )
        .expect("cascade customer key update");
    let child_customer: String = connection
        .query_row(
            "SELECT customer_id FROM schedules WHERE id = ?1",
            [schedule.id],
            |row| row.get(0),
        )
        .expect("cascaded schedule customer");
    assert_eq!(child_customer, replacement);
    drop(connection);
    drop(repository);
    cleanup(&path);
}
