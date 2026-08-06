mod families;
mod memberships;
mod visibility;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use uuid::Uuid;

use crate::database;

use super::model::{AddFamilyMembershipInput, CreateFamilyInput, MembershipWrite};
use super::validation::{validate_add, validate_create};
use super::FamilyRepository;

const CUSTOMER_ONE: &str = "20000000-0000-4000-8000-000000000001";
const CUSTOMER_TWO: &str = "20000000-0000-4000-8000-000000000002";

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-family-{label}-{}.sqlite3", Uuid::new_v4()))
}

fn seed_customers(path: &Path) {
    let connection = database::open(path).expect("migrated family database");
    for (id, name) in [
        (CUSTOMER_ONE, "합성 나 고객"),
        (CUSTOMER_TWO, "합성 가 고객"),
    ] {
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES (?1, ?2)",
                params![id, name],
            )
            .expect("insert synthetic customer");
    }
}

fn create_family(repository: &FamilyRepository, name: &str) -> super::model::Family {
    repository
        .create(
            validate_create(CreateFamilyInput {
                name: name.to_owned(),
            })
            .expect("valid family"),
        )
        .expect("create family")
}

fn membership_write(customer_id: &str, relationship: Option<&str>) -> MembershipWrite {
    validate_add(AddFamilyMembershipInput {
        customer_id: customer_id.to_owned(),
        relationship_name: relationship.map(str::to_owned),
    })
    .expect("valid membership")
}

fn set_deleted(path: &Path, table: &str, id: &str, deleted: bool) {
    assert!(matches!(table, "families" | "customers"));
    let connection = database::open(path).expect("parent state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            &format!("UPDATE {table} SET deleted_at = ?2 WHERE id = ?1"),
            params![id, deleted_at],
        )
        .expect("update parent state");
}

fn cleanup(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database") {
            fs::remove_file(candidate).expect("remove temporary database");
        }
    }
}
