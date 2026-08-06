use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{
    august_range, cleanup, create_write, seed_customers, temp_path, update_write,
    ScheduleRepository, CUSTOMER_ONE, CUSTOMER_TWO,
};

#[test]
fn lists_half_open_range_stably_with_all_day_first() {
    let path = temp_path("range-order");
    seed_customers(&path);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let before = repository
        .create(create_write("합성 이전", "2026-07-31", None, None))
        .expect("create before range");
    let all_day = repository
        .create(create_write("합성 종일", "2026-08-06", None, None))
        .expect("create all-day schedule");
    let early = repository
        .create(create_write("합성 이른", "2026-08-06", Some("09:00"), None))
        .expect("create early schedule");
    let late = repository
        .create(create_write("합성 늦은", "2026-08-06", Some("18:00"), None))
        .expect("create late schedule");
    let after = repository
        .create(create_write("합성 이후", "2026-09-01", None, None))
        .expect("create after range");

    let listed = repository.list(&august_range()).expect("list schedules");
    assert_eq!(
        listed
            .iter()
            .map(|item| item.id.as_str())
            .collect::<Vec<_>>(),
        vec![all_day.id.as_str(), early.id.as_str(), late.id.as_str()]
    );
    assert!(!listed
        .iter()
        .any(|item| item.id == before.id || item.id == after.id));
    drop(repository);
    cleanup(&path);
}

#[test]
fn title_ties_follow_ecmascript_utf16_code_unit_order() {
    let path = temp_path("unicode-order");
    seed_customers(&path);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let bmp = repository
        .create(create_write("\u{e000}", "2026-08-06", None, None))
        .expect("create BMP schedule");
    let supplementary = repository
        .create(create_write("\u{10000}", "2026-08-06", None, None))
        .expect("create supplementary schedule");

    let listed = repository.list(&august_range()).expect("list schedules");
    assert_eq!(listed[0].id, supplementary.id);
    assert_eq!(listed[1].id, bmp.id);
    drop(repository);
    cleanup(&path);
}

#[test]
fn creates_updates_relinks_unlinks_completes_and_soft_deletes() {
    let path = temp_path("crud");
    seed_customers(&path);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");
    let created = repository
        .create(create_write(
            " 합성 연결 일정 ",
            "2026-08-06",
            Some("09:05"),
            Some(CUSTOMER_ONE),
        ))
        .expect("create linked schedule");
    assert_eq!(created.customer_id.as_deref(), Some(CUSTOMER_ONE));
    assert_eq!(created.title, "합성 연결 일정");
    assert_eq!(created.memo.as_deref(), Some("합성 일정 메모"));

    let relinked = repository
        .update(&created.id, update_write(Some(CUSTOMER_TWO)))
        .expect("relink schedule");
    assert_eq!(relinked.customer_id.as_deref(), Some(CUSTOMER_TWO));
    assert_eq!(relinked.scheduled_on, "2026-08-07");
    assert_eq!(relinked.scheduled_time, None);
    assert!(relinked.is_completed);

    let unlinked = repository
        .update(&created.id, update_write(None))
        .expect("unlink schedule");
    assert_eq!(unlinked.customer_id, None);
    let reopened_state = repository
        .set_completed(&created.id, false)
        .expect("restore incomplete state");
    assert!(!reopened_state.is_completed);

    repository
        .soft_delete(&created.id)
        .expect("soft delete schedule");
    assert!(repository
        .list(&august_range())
        .expect("active list")
        .is_empty());
    assert_eq!(
        repository.soft_delete(&created.id),
        Err(AppError::ScheduleNotFound)
    );

    drop(repository);
    let connection = database::open(&path).expect("inspect retained schedule");
    let retained: (Option<String>, bool) = connection
        .query_row(
            "SELECT customer_id, deleted_at IS NOT NULL FROM schedules WHERE id = ?1",
            params![created.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("soft-deleted schedule row");
    assert_eq!(retained, (None, true));
    drop(connection);
    cleanup(&path);
}

#[test]
fn persists_local_wall_time_and_boolean_across_reopen() {
    let path = temp_path("persistence");
    seed_customers(&path);
    let schedule_id = {
        let repository = ScheduleRepository::open(&path).expect("first repository");
        let schedule = repository
            .create(create_write(
                "합성 지속 일정",
                "2026-08-31",
                Some("23:59"),
                Some(CUSTOMER_ONE),
            ))
            .expect("create persisted schedule");
        repository
            .set_completed(&schedule.id, true)
            .expect("persist completion");
        schedule.id
    };

    let reopened = ScheduleRepository::open(&path).expect("reopen repository");
    let schedule = reopened
        .list(&august_range())
        .expect("list persisted schedule")
        .pop()
        .expect("persisted schedule");
    assert_eq!(schedule.id, schedule_id);
    assert_eq!(schedule.scheduled_on, "2026-08-31");
    assert_eq!(schedule.scheduled_time.as_deref(), Some("23:59"));
    assert!(schedule.is_completed);
    let payload = serde_json::to_value(schedule).expect("serialize IPC schedule");
    assert_eq!(payload["customerId"], CUSTOMER_ONE);
    assert_eq!(payload["isCompleted"], true);
    assert!(payload.get("deletedAt").is_none());
    drop(reopened);
    cleanup(&path);
}
