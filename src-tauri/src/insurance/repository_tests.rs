use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::params;
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{CreateInsurancePolicyInput, UpdateInsurancePolicyInput};
use super::validation::{validate_create, validate_update};
use super::InsurancePolicyRepository;

const CUSTOMER_ID: &str = "36486154-1c4e-4a37-b0e8-2b6a3a8d7932";

fn create_input(premium: &str, included: bool) -> CreateInsurancePolicyInput {
    CreateInsurancePolicyInput {
        insurer: "합성보험사".to_owned(),
        product_name: "합성보험상품".to_owned(),
        joined_on: Some("2024-01-02".to_owned()),
        coverage_term: Some("종신".to_owned()),
        payment_term: Some("20년".to_owned()),
        monthly_premium_won: premium.to_owned(),
        disclosure_plan: Some("합성고지플랜".to_owned()),
        matures_on: Some("2050-01-02".to_owned()),
        renewable: false,
        status: Some("유지".to_owned()),
        is_included: included,
    }
}

fn update_input(premium: &str, included: bool) -> UpdateInsurancePolicyInput {
    UpdateInsurancePolicyInput {
        insurer: "합성보험사 수정".to_owned(),
        product_name: "합성보험상품 수정".to_owned(),
        joined_on: None,
        coverage_term: Some("10년".to_owned()),
        payment_term: None,
        monthly_premium_won: premium.to_owned(),
        disclosure_plan: None,
        matures_on: None,
        renewable: true,
        status: Some("변경".to_owned()),
        is_included: included,
    }
}

#[test]
fn creates_lists_updates_sums_and_soft_deletes_active_policies() {
    let path = temp_path("crud");
    seed_customer(&path, CUSTOMER_ID);
    let repository = InsurancePolicyRepository::open(&path).expect("policy repository");
    let included = repository
        .create(
            CUSTOMER_ID,
            validate_create(create_input("125000", true)).expect("valid included policy"),
        )
        .expect("create included policy");
    let excluded = repository
        .create(
            CUSTOMER_ID,
            validate_create(create_input("99000", false)).expect("valid excluded policy"),
        )
        .expect("create excluded policy");

    let policies = repository.list(CUSTOMER_ID).expect("list policies");
    let total = policies
        .iter()
        .filter(|policy| policy.is_included)
        .map(|policy| {
            policy
                .monthly_premium_won
                .parse::<i128>()
                .expect("canonical money")
        })
        .sum::<i128>();
    assert_eq!(policies.len(), 2);
    assert_eq!(total, 125_000);
    assert_eq!(included.monthly_premium_won, "125000");

    let updated = repository
        .update(
            &included.id,
            validate_update(update_input("130000", true)).expect("valid update"),
        )
        .expect("update policy");
    assert_eq!(updated.product_name, "합성보험상품 수정");
    assert_eq!(updated.monthly_premium_won, "130000");
    assert!(updated.renewable);

    repository
        .soft_delete(&excluded.id)
        .expect("soft delete policy");
    assert_eq!(repository.list(CUSTOMER_ID).expect("active list").len(), 1);
    assert_eq!(
        repository.soft_delete(&excluded.id),
        Err(AppError::InsurancePolicyNotFound)
    );
    drop(repository);

    let connection = database::open(&path).expect("inspect persisted database");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM insurance_policies WHERE id = ?1 AND deleted_at IS NOT NULL",
            [&excluded.id],
            |row| row.get(0),
        )
        .expect("soft-deleted row");
    assert_eq!(retained, 1);
    drop(connection);
    cleanup(&path);
}

#[test]
fn persists_across_reopen_and_keeps_decimal_string_contract() {
    let path = temp_path("persistence");
    seed_customer(&path, CUSTOMER_ID);
    let policy_id = {
        let repository = InsurancePolicyRepository::open(&path).expect("first repository");
        repository
            .create(
                CUSTOMER_ID,
                validate_create(create_input("9223372036854775807", true)).expect("maximum money"),
            )
            .expect("create persisted policy")
            .id
    };

    let reopened = InsurancePolicyRepository::open(&path).expect("reopen repository");
    let policy = reopened
        .list(CUSTOMER_ID)
        .expect("list persisted policy")
        .pop()
        .expect("persisted policy");
    assert_eq!(policy.id, policy_id);
    assert_eq!(policy.monthly_premium_won, "9223372036854775807");
    let payload = serde_json::to_value(policy).expect("serialize IPC policy");
    assert_eq!(payload["monthlyPremiumWon"], "9223372036854775807");
    drop(reopened);
    cleanup(&path);
}

#[test]
fn hides_children_of_soft_deleted_customers_and_restores_visibility() {
    let path = temp_path("parent-soft-delete");
    seed_customer(&path, CUSTOMER_ID);
    let repository = InsurancePolicyRepository::open(&path).expect("policy repository");
    let policy = repository
        .create(
            CUSTOMER_ID,
            validate_create(create_input("50000", true)).expect("valid policy"),
        )
        .expect("create policy");

    set_customer_deleted(&path, CUSTOMER_ID, true);
    assert_eq!(
        repository.list(CUSTOMER_ID),
        Err(AppError::CustomerNotFound)
    );
    assert_eq!(
        repository.create(
            CUSTOMER_ID,
            validate_create(create_input("1", true)).expect("valid policy")
        ),
        Err(AppError::CustomerNotFound)
    );
    assert_eq!(
        repository.update(
            &policy.id,
            validate_update(update_input("51000", true)).expect("valid update")
        ),
        Err(AppError::InsurancePolicyNotFound)
    );
    assert_eq!(
        repository.soft_delete(&policy.id),
        Err(AppError::InsurancePolicyNotFound)
    );

    let connection = database::open(&path).expect("inspect hidden child");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM insurance_policies WHERE id = ?1 AND deleted_at IS NULL",
            [&policy.id],
            |row| row.get(0),
        )
        .expect("retained child");
    assert_eq!(retained, 1);
    drop(connection);

    set_customer_deleted(&path, CUSTOMER_ID, false);
    assert_eq!(
        repository.list(CUSTOMER_ID).expect("restored list").len(),
        1
    );
    drop(repository);
    cleanup(&path);
}

#[test]
fn foreign_key_restricts_hard_delete_and_missing_customers() {
    let path = temp_path("foreign-key");
    seed_customer(&path, CUSTOMER_ID);
    let repository = InsurancePolicyRepository::open(&path).expect("policy repository");
    repository
        .create(
            CUSTOMER_ID,
            validate_create(create_input("1000", true)).expect("valid policy"),
        )
        .expect("create policy");
    assert_eq!(
        repository.list("f92cd68e-81f8-44ee-a082-6748852c065d"),
        Err(AppError::CustomerNotFound)
    );

    let connection = database::open(&path).expect("foreign key connection");
    let result = connection.execute("DELETE FROM customers WHERE id = ?1", [CUSTOMER_ID]);
    assert!(result.is_err(), "hard delete must be restricted by the FK");
    drop(connection);
    drop(repository);
    cleanup(&path);
}

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-policy-{label}-{}.sqlite3", Uuid::new_v4()))
}

fn seed_customer(path: &Path, id: &str) {
    let connection = database::open(path).expect("migrated database");
    connection
        .execute(
            r#"INSERT INTO customers (id, name, is_managed, created_at, updated_at)
               VALUES (?1, ?2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            params![id, "합성고객"],
        )
        .expect("seed synthetic customer");
}

fn set_customer_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("customer state connection");
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
