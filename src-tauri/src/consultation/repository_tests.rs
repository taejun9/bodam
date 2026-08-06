mod crud;
mod visibility;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use uuid::Uuid;

use crate::database;

use super::model::{ConsultationWrite, CreateConsultationInput, UpdateConsultationInput};
use super::validation::{validate_create, validate_update};
use super::ConsultationRepository;

const CUSTOMER_ONE: &str = "20000000-0000-4000-8000-000000000001";
const CUSTOMER_TWO: &str = "20000000-0000-4000-8000-000000000002";

fn create_write(consulted_at: &str, content: Option<&str>) -> ConsultationWrite {
    validate_create(CreateConsultationInput {
        consulted_at: consulted_at.to_owned(),
        content: content.map(str::to_owned),
        next_contact_on: Some("2026-09-01".to_owned()),
        result: Some("합성 후속 결과".to_owned()),
    })
    .expect("valid consultation create input")
}

fn update_write(consulted_at: &str) -> ConsultationWrite {
    validate_update(UpdateConsultationInput {
        consulted_at: consulted_at.to_owned(),
        content: Some(" 합성 수정 기록 ".to_owned()),
        next_contact_on: None,
        result: Some(" 합성 수정 결과 ".to_owned()),
    })
    .expect("valid consultation update input")
}

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "bodam-consultation-{label}-{}.sqlite3",
        Uuid::new_v4()
    ))
}

fn seed_customers(path: &Path) {
    let connection = database::open(path).expect("migrated consultation database");
    for (id, name) in [
        (CUSTOMER_ONE, "합성 상담 고객 A"),
        (CUSTOMER_TWO, "합성 상담 고객 B"),
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
