mod concurrency;
mod crud;
mod visibility;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use uuid::Uuid;

use crate::database;

use super::model::{CreateScheduleInput, ScheduleRange, ScheduleWrite, UpdateScheduleInput};
use super::validation::{validate_create, validate_update};
use super::ScheduleRepository;

const CUSTOMER_ONE: &str = "20000000-0000-4000-8000-000000000001";
const CUSTOMER_TWO: &str = "20000000-0000-4000-8000-000000000002";

fn create_write(
    title: &str,
    scheduled_on: &str,
    scheduled_time: Option<&str>,
    customer_id: Option<&str>,
) -> ScheduleWrite {
    validate_create(CreateScheduleInput {
        title: title.to_owned(),
        scheduled_on: scheduled_on.to_owned(),
        scheduled_time: scheduled_time.map(str::to_owned),
        memo: Some(" 합성 일정 메모 ".to_owned()),
        customer_id: customer_id.map(str::to_owned),
        is_completed: false,
    })
    .expect("valid schedule create input")
}

fn update_write(customer_id: Option<&str>) -> ScheduleWrite {
    validate_update(UpdateScheduleInput {
        title: " 합성 수정 일정 ".to_owned(),
        scheduled_on: "2026-08-07".to_owned(),
        scheduled_time: None,
        memo: None,
        customer_id: customer_id.map(str::to_owned),
        is_completed: true,
    })
    .expect("valid schedule update input")
}

fn august_range() -> ScheduleRange {
    ScheduleRange {
        start_on: "2026-08-01".to_owned(),
        end_before: "2026-09-01".to_owned(),
    }
}

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-schedule-{label}-{}.sqlite3", Uuid::new_v4()))
}

fn seed_customers(path: &Path) {
    let connection = database::open(path).expect("migrated schedule database");
    for (id, name) in [
        (CUSTOMER_ONE, "합성 일정 고객 A"),
        (CUSTOMER_TWO, "합성 일정 고객 B"),
    ] {
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES (?1, ?2)",
                params![id, name],
            )
            .expect("insert synthetic customer");
    }
}

fn set_customer_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("customer state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            "UPDATE customers SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )
        .expect("update synthetic customer state");
}

fn cleanup(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database") {
            fs::remove_file(candidate).expect("remove temporary database");
        }
    }
}
