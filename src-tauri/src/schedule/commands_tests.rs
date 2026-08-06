use std::fs;

use rusqlite::params;
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::commands::{
    create_with_repository, delete_with_repository, list_with_repository,
    set_completed_with_repository, update_with_repository,
};
use super::model::{CreateScheduleInput, UpdateScheduleInput};
use super::ScheduleRepository;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000006";

#[test]
fn command_boundary_validates_and_runs_schedule_contract() {
    let path =
        std::env::temp_dir().join(format!("bodam-schedule-command-{}.sqlite3", Uuid::new_v4()));
    let connection = database::open(&path).expect("command test database");
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, ?2)",
            params![CUSTOMER_ID, "합성 명령 고객"],
        )
        .expect("seed command customer");
    drop(connection);
    let repository = ScheduleRepository::open(&path).expect("schedule repository");

    let created = create_with_repository(
        &repository,
        CreateScheduleInput {
            title: " 합성 명령 일정 ".to_owned(),
            scheduled_on: "2026-08-06".to_owned(),
            scheduled_time: Some("12:00".to_owned()),
            memo: None,
            customer_id: Some(CUSTOMER_ID.to_owned()),
            is_completed: false,
        },
    )
    .expect("command create");
    assert_eq!(created.title, "합성 명령 일정");
    assert_eq!(
        list_with_repository(
            &repository,
            "2026-08-01".to_owned(),
            "2026-09-01".to_owned(),
        )
        .expect("command list")
        .len(),
        1
    );

    let updated = update_with_repository(
        &repository,
        created.id.clone(),
        UpdateScheduleInput {
            title: "합성 수정 명령 일정".to_owned(),
            scheduled_on: "2026-08-07".to_owned(),
            scheduled_time: None,
            memo: Some(" 합성 메모 ".to_owned()),
            customer_id: None,
            is_completed: false,
        },
    )
    .expect("command update");
    assert_eq!(updated.memo.as_deref(), Some("합성 메모"));
    assert!(
        set_completed_with_repository(&repository, created.id.clone(), true)
            .expect("command complete")
            .is_completed
    );
    assert_eq!(
        delete_with_repository(&repository, created.id.clone())
            .expect("command delete")
            .id,
        created.id
    );

    let rejected = "synthetic-command-rejected-marker";
    let error = delete_with_repository(&repository, rejected.to_owned())
        .expect_err("command rejects invalid schedule ID");
    let encoded = serde_json::to_string(&error).expect("serialize command error");
    assert!(!encoded.contains(rejected));
    assert!(matches!(
        list_with_repository(
            &repository,
            "2026-08-01".to_owned(),
            "2026-08-01".to_owned(),
        ),
        Err(AppError::Validation(_))
    ));
    drop(repository);
    cleanup(&path);
}

fn cleanup(path: &std::path::Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary command database") {
            fs::remove_file(candidate).expect("remove temporary command database");
        }
    }
}
