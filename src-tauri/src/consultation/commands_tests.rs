use std::fs;

use rusqlite::params;
use uuid::Uuid;

use crate::database;

use super::commands::{
    create_with_repository, delete_with_repository, list_with_repository, update_with_repository,
};
use super::model::{CreateConsultationInput, UpdateConsultationInput};
use super::ConsultationRepository;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000006";

#[test]
fn command_boundary_validates_and_runs_the_crud_contract() {
    let path = std::env::temp_dir().join(format!(
        "bodam-consultation-command-{}.sqlite3",
        Uuid::new_v4()
    ));
    let connection = database::open(&path).expect("command test database");
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, ?2)",
            params![CUSTOMER_ID, "합성 명령 고객"],
        )
        .expect("seed command customer");
    drop(connection);
    let repository = ConsultationRepository::open(&path).expect("consultation repository");

    let created = create_with_repository(
        &repository,
        CUSTOMER_ID.to_owned(),
        CreateConsultationInput {
            consulted_at: "2026-08-06T12:00:00+09:00".to_owned(),
            content: None,
            next_contact_on: None,
            result: None,
        },
    )
    .expect("command create");
    assert_eq!(created.consulted_at, "2026-08-06T03:00:00.000Z");
    assert_eq!(
        list_with_repository(&repository, CUSTOMER_ID.to_owned())
            .expect("command list")
            .len(),
        1
    );

    let updated = update_with_repository(
        &repository,
        created.id.clone(),
        UpdateConsultationInput {
            consulted_at: "2026-08-07T12:00:00+09:00".to_owned(),
            content: Some(" 합성 명령 기록 ".to_owned()),
            next_contact_on: Some("2026-08-20".to_owned()),
            result: None,
        },
    )
    .expect("command update");
    assert_eq!(updated.content.as_deref(), Some("합성 명령 기록"));
    assert_eq!(
        delete_with_repository(&repository, created.id.clone())
            .expect("command delete")
            .id,
        created.id
    );

    let rejected = "synthetic-command-rejected-id";
    let error = list_with_repository(&repository, rejected.to_owned())
        .expect_err("command rejects invalid customer ID");
    let encoded = serde_json::to_string(&error).expect("serialize command error");
    assert!(!encoded.contains(rejected));
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
