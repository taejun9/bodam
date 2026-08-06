mod categories;
mod coverages;
mod visibility;

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use uuid::Uuid;

use crate::coverage::model::{CoverageWrite, CreateCoverageInput};
use crate::coverage::validation::validate_create;
use crate::database;

use super::CoverageRepository;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const OTHER_CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000002";
const INCLUDED_POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const EXCLUDED_POLICY_ID: &str = "30000000-0000-4000-8000-000000000002";
const CATEGORY_ONE: &str = "10000000-0000-4000-8000-000000000001";
const CATEGORY_TWO: &str = "10000000-0000-4000-8000-000000000002";

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-coverage-{label}-{}.sqlite3", Uuid::new_v4()))
}

fn seed_customer_and_policies(path: &Path) {
    let connection = database::open(path).expect("migrated coverage database");
    for (id, name) in [
        (CUSTOMER_ID, "합성 보장고객"),
        (OTHER_CUSTOMER_ID, "합성 다른고객"),
    ] {
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES (?1, ?2)",
                params![id, name],
            )
            .expect("insert synthetic customer");
    }
    for (id, included) in [(INCLUDED_POLICY_ID, true), (EXCLUDED_POLICY_ID, false)] {
        connection
            .execute(
                "INSERT INTO insurance_policies
                 (id, customer_id, insurer, product_name, monthly_premium_won, is_included)
                 VALUES (?1, ?2, ?3, ?4, 1000, ?5)",
                params![id, CUSTOMER_ID, "합성보험사", "합성보장상품", included],
            )
            .expect("insert synthetic policy");
    }
}

fn write(category_id: &str, amount_won: &str) -> CoverageWrite {
    validate_create(CreateCoverageInput {
        category_id: category_id.to_owned(),
        amount_won: amount_won.to_owned(),
    })
    .expect("valid synthetic coverage")
}

fn set_customer_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("customer state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            "UPDATE customers SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )
        .expect("update customer state");
}

fn set_policy_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("policy state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            "UPDATE insurance_policies SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )
        .expect("update policy state");
}

fn set_category_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("category state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            "UPDATE coverage_categories SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )
        .expect("update category state");
}

fn cleanup(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database") {
            fs::remove_file(candidate).expect("remove temporary database");
        }
    }
}
