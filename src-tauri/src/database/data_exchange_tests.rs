use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_data_exchange_schema_for_test;

#[test]
fn clean_database_creates_named_policy_import_source_schema() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply registered migrations");

    verify_data_exchange_schema_for_test(&connection).expect("import source schema contract");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("migration history count");
    assert_eq!(history_count, MIGRATIONS.len() as i64);
}

#[test]
fn upgrades_v7_without_losing_existing_policy_rows() {
    let mut connection = Connection::open_in_memory().expect("v7 database");
    apply_for_test(&mut connection, &MIGRATIONS[..7]).expect("apply v7 migrations");
    connection
        .execute(
            "INSERT INTO customers
             (id, name, is_managed, created_at, updated_at)
             VALUES (?1, ?2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params!["synthetic-customer", "합성 고객"],
        )
        .expect("insert customer");
    connection
        .execute(
            "INSERT INTO insurance_policies
             (id, customer_id, insurer, product_name, monthly_premium_won,
              renewable, is_included, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, false, true,
                     CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)",
            params![
                "synthetic-policy",
                "synthetic-customer",
                "합성 보험사",
                "합성 상품",
                12_000_i64
            ],
        )
        .expect("insert policy");

    run(&mut connection).expect("upgrade to v8");
    let policy_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM insurance_policies", [], |row| {
            row.get(0)
        })
        .expect("policy count");
    let source_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM insurance_policy_import_sources",
            [],
            |row| row.get(0),
        )
        .expect("source count");
    assert_eq!(policy_count, 1);
    assert_eq!(source_count, 0);
}

#[test]
fn rejects_source_column_and_foreign_key_drift() {
    let migration = MIGRATIONS[7].sql;
    let variants = [
        replace_once(
            migration,
            "\"policy_number\" TEXT",
            "\"policy_number\" INTEGER",
        ),
        replace_once(
            migration,
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("schema drift database");
        for registered in &MIGRATIONS[..7] {
            connection
                .execute_batch(registered.sql)
                .expect("create prerequisite schema");
        }
        connection
            .execute_batch(&variant)
            .expect("create drifted source schema");
        assert_eq!(
            verify_data_exchange_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
