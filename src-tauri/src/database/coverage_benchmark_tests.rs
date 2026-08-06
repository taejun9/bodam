use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_coverage_benchmark_schema_for_test;

const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";
const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const COVERAGE_ID: &str = "40000000-0000-4000-8000-000000000001";
const FAMILY_ID: &str = "50000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID: &str = "60000000-0000-4000-8000-000000000001";
const CONSULTATION_ID: &str = "70000000-0000-4000-8000-000000000001";
const BENCHMARK_ID: &str = "80000000-0000-4000-8000-000000000001";

#[test]
fn clean_database_applies_v6_schema_without_benchmark_seed() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v6 migrations");

    let benchmark_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM coverage_benchmarks", [], |row| {
            row.get(0)
        })
        .expect("benchmark seed count");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(benchmark_count, 0);
    assert_eq!(history_count, MIGRATIONS.len() as i64);
    verify_coverage_benchmark_schema_for_test(&connection).expect("benchmark schema contract");
}

#[test]
fn upgrades_v5_without_losing_existing_domain_rows() {
    let mut connection = Connection::open_in_memory().expect("v5 database");
    apply_for_test(&mut connection, &MIGRATIONS[..5]).expect("apply v5 migrations");
    insert_v5_rows(&connection);

    run(&mut connection).expect("upgrade to v6");
    for (table, id) in [
        ("customers", CUSTOMER_ID),
        ("insurance_policies", POLICY_ID),
        ("coverages", COVERAGE_ID),
        ("families", FAMILY_ID),
        ("family_memberships", MEMBERSHIP_ID),
        ("consultations", CONSULTATION_ID),
    ] {
        let count: i64 = connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                [id],
                |row| row.get(0),
            )
            .expect("preserved v5 row");
        assert_eq!(count, 1, "{table} row must survive v6 upgrade");
    }
    let benchmark_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM coverage_benchmarks", [], |row| {
            row.get(0)
        })
        .expect("benchmark row count");
    assert_eq!(benchmark_count, 0);
}

#[test]
fn refuses_drifted_v5_before_creating_benchmark_table() {
    let mut connection = Connection::open_in_memory().expect("drifted v5 database");
    apply_for_test(&mut connection, &MIGRATIONS[..5]).expect("apply v5 migrations");
    connection
        .execute(
            "DROP INDEX consultations_customer_id_deleted_at_consulted_at_idx",
            [],
        )
        .expect("introduce v5 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema
             WHERE type = 'table' AND name = 'coverage_benchmarks'",
            [],
            |row| row.get(0),
        )
        .expect("benchmark table count");
    assert_eq!(table_count, 0);
}

#[test]
fn detects_benchmark_column_index_and_foreign_key_drift() {
    let migration = MIGRATIONS[5].sql;
    let variants = [
        replace_once(
            migration,
            "\"min_age_years\" INTEGER NOT NULL",
            "\"min_age_years\" TEXT NOT NULL",
        ),
        replace_once(
            migration,
            "(\"deleted_at\", \"category_id\", \"gender\", \"min_age_years\", \"max_age_years\")",
            "(\"category_id\", \"deleted_at\", \"gender\", \"min_age_years\", \"max_age_years\")",
        ),
        migration.replace(
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("benchmark drift database");
        for registered in &MIGRATIONS[..5] {
            connection
                .execute_batch(registered.sql)
                .expect("create v5 schema");
        }
        connection
            .execute_batch(&variant)
            .expect("create drifted benchmark schema");
        assert_eq!(
            verify_coverage_benchmark_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

#[test]
fn category_key_lifecycle_preserves_benchmark_relation() {
    let mut connection = Connection::open_in_memory().expect("category relation database");
    connection
        .pragma_update(None, "foreign_keys", true)
        .expect("enable foreign keys");
    run(&mut connection).expect("apply v6 migrations");
    connection
        .execute(
            "INSERT INTO coverage_benchmarks
             (id, category_id, gender, min_age_years, max_age_years,
              adequate_min_won, excessive_min_won)
             VALUES (?1, ?2, '합성성별', 20, 29, 100, 200)",
            params![BENCHMARK_ID, CATEGORY_ID],
        )
        .expect("insert synthetic benchmark");
    connection
        .execute(
            "UPDATE coverage_categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [CATEGORY_ID],
        )
        .expect("soft delete category");

    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverage_benchmarks WHERE id = ?1 AND deleted_at IS NULL",
            [BENCHMARK_ID],
            |row| row.get(0),
        )
        .expect("retained benchmark");
    assert_eq!(retained, 1);
    assert!(connection
        .execute(
            "DELETE FROM coverage_categories WHERE id = ?1",
            [CATEGORY_ID]
        )
        .is_err());

    let replacement_id = "10000000-0000-4000-8000-000000000099";
    connection
        .execute(
            "UPDATE coverage_categories SET id = ?2 WHERE id = ?1",
            params![CATEGORY_ID, replacement_id],
        )
        .expect("cascade category key update");
    let child_category: String = connection
        .query_row(
            "SELECT category_id FROM coverage_benchmarks WHERE id = ?1",
            [BENCHMARK_ID],
            |row| row.get(0),
        )
        .expect("cascaded child category");
    assert_eq!(child_category, replacement_id);
}

fn insert_v5_rows(connection: &Connection) {
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
    connection
        .execute(
            "INSERT INTO consultations (id, customer_id, consulted_at)
             VALUES (?1, ?2, '2026-08-06T00:00:00.000Z')",
            params![CONSULTATION_ID, CUSTOMER_ID],
        )
        .expect("insert consultation");
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
