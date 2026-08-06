use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_insurance_schema_for_test;

#[test]
fn clean_database_applies_both_registered_migrations() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply registered migrations");

    let history = connection
        .prepare(
            "SELECT migration_name, checksum_sha256
             FROM bodam_schema_migrations ORDER BY rowid",
        )
        .expect("history statement")
        .query_map([], |row| {
            Ok((row.get::<_, String>(0)?, row.get::<_, String>(1)?))
        })
        .expect("history query")
        .collect::<Result<Vec<_>, _>>()
        .expect("history rows");
    let expected = MIGRATIONS
        .iter()
        .map(|migration| {
            (
                migration.name.to_owned(),
                migration.checksum_sha256.to_owned(),
            )
        })
        .collect::<Vec<_>>();
    assert_eq!(history, expected);
    verify_insurance_schema_for_test(&connection).expect("policy schema contract");
}

#[test]
fn upgrades_existing_customer_database_without_losing_rows() {
    let mut connection = Connection::open_in_memory().expect("legacy database");
    apply_for_test(&mut connection, &MIGRATIONS[..1]).expect("apply customer migration only");
    connection
        .execute(
            r#"INSERT INTO customers
               (id, name, is_managed, created_at, updated_at)
               VALUES (?1, ?2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            params!["synthetic-existing-customer", "합성 기존고객"],
        )
        .expect("insert existing synthetic row");

    run(&mut connection).expect("upgrade existing database");
    let customer_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .expect("customer count");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(customer_count, 1);
    assert_eq!(history_count, MIGRATIONS.len() as i64);
    verify_insurance_schema_for_test(&connection).expect("upgraded policy schema");
}

#[test]
fn refuses_to_upgrade_a_drifted_existing_schema_before_mutating_it() {
    let mut connection = Connection::open_in_memory().expect("drifted legacy database");
    apply_for_test(&mut connection, &MIGRATIONS[..1]).expect("apply customer migration only");
    connection
        .execute("DROP INDEX customers_deleted_at_idx", [])
        .expect("introduce legacy drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let policy_table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = 'insurance_policies'",
            [],
            |row| row.get(0),
        )
        .expect("policy table count");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(policy_table_count, 0);
    assert_eq!(history_count, 1);
}

#[test]
fn detects_policy_column_index_and_foreign_key_drift() {
    let policy_migration = MIGRATIONS[1].sql;
    let variants = [
        replace_once(
            policy_migration,
            "\"monthly_premium_won\" BIGINT NOT NULL",
            "\"monthly_premium_won\" REAL NOT NULL",
        ),
        replace_once(
            policy_migration,
            "(\"customer_id\", \"deleted_at\")",
            "(\"deleted_at\", \"customer_id\")",
        ),
        replace_once(
            policy_migration,
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("schema drift database");
        connection
            .execute_batch(MIGRATIONS[0].sql)
            .expect("create customer schema");
        connection
            .execute_batch(&variant)
            .expect("create changed policy schema");
        assert_eq!(
            verify_insurance_schema_for_test(&connection),
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
