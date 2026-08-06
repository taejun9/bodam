use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_consultation_schema_for_test;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const COVERAGE_ID: &str = "40000000-0000-4000-8000-000000000001";
const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";
const FAMILY_ID: &str = "50000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID: &str = "60000000-0000-4000-8000-000000000001";

#[test]
fn clean_database_applies_v5_consultation_schema_and_history() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v5 migrations");

    let table: String = connection
        .query_row(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'consultations'",
            [],
            |row| row.get(0),
        )
        .expect("consultation table");
    assert_eq!(table, "consultations");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(history_count, MIGRATIONS.len() as i64);
    verify_consultation_schema_for_test(&connection).expect("consultation schema contract");
}

#[test]
fn upgrades_v4_without_losing_existing_domain_rows() {
    let mut connection = Connection::open_in_memory().expect("v4 database");
    apply_for_test(&mut connection, &MIGRATIONS[..4]).expect("apply v4 migrations");
    insert_v4_rows(&connection);

    run(&mut connection).expect("upgrade to v5");
    for (table, id) in [
        ("customers", CUSTOMER_ID),
        ("insurance_policies", POLICY_ID),
        ("coverages", COVERAGE_ID),
        ("coverage_categories", CATEGORY_ID),
        ("families", FAMILY_ID),
        ("family_memberships", MEMBERSHIP_ID),
    ] {
        let count: i64 = connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                [id],
                |row| row.get(0),
            )
            .expect("preserved row");
        assert_eq!(count, 1, "{table} row must survive v5 upgrade");
    }
}

#[test]
fn refuses_drifted_v4_before_creating_consultation_table() {
    let mut connection = Connection::open_in_memory().expect("drifted v4 database");
    apply_for_test(&mut connection, &MIGRATIONS[..4]).expect("apply v4 migrations");
    connection
        .execute("DROP INDEX families_deleted_at_name_idx", [])
        .expect("introduce v4 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema
             WHERE type = 'table' AND name = 'consultations'",
            [],
            |row| row.get(0),
        )
        .expect("consultation table count");
    assert_eq!(table_count, 0);
}

#[test]
fn detects_consultation_column_index_and_foreign_key_drift() {
    let migration = MIGRATIONS[4].sql;
    let variants = [
        replace_once(
            migration,
            "\"consulted_at\" DATETIME NOT NULL",
            "\"consulted_at\" TEXT NOT NULL",
        ),
        replace_once(
            migration,
            "(\"customer_id\", \"deleted_at\", \"consulted_at\")",
            "(\"customer_id\", \"consulted_at\", \"deleted_at\")",
        ),
        migration.replace(
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("consultation drift database");
        for migration in &MIGRATIONS[..4] {
            connection
                .execute_batch(migration.sql)
                .expect("create v4 schema");
        }
        connection
            .execute_batch(&variant)
            .expect("create drifted consultation schema");
        assert_eq!(
            verify_consultation_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

fn insert_v4_rows(connection: &Connection) {
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, '합성 기존 고객')",
            [CUSTOMER_ID],
        )
        .expect("insert customer");
    connection
        .execute(
            "INSERT INTO insurance_policies
             (id, customer_id, insurer, product_name, monthly_premium_won)
             VALUES (?1, ?2, '합성보험사', '합성상품', 1000)",
            params![POLICY_ID, CUSTOMER_ID],
        )
        .expect("insert policy");
    connection
        .execute(
            "INSERT INTO coverages (id, policy_id, category_id, amount_won)
             VALUES (?1, ?2, ?3, 5000)",
            params![COVERAGE_ID, POLICY_ID, CATEGORY_ID],
        )
        .expect("insert coverage");
    connection
        .execute(
            "INSERT INTO families (id, name) VALUES (?1, '합성 기존 가족')",
            [FAMILY_ID],
        )
        .expect("insert family");
    connection
        .execute(
            "INSERT INTO family_memberships (id, family_id, customer_id)
             VALUES (?1, ?2, ?3)",
            params![MEMBERSHIP_ID, FAMILY_ID, CUSTOMER_ID],
        )
        .expect("insert membership");
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
