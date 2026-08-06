use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_schedule_schema_for_test;

const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";
const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const COVERAGE_ID: &str = "40000000-0000-4000-8000-000000000001";
const FAMILY_ID: &str = "50000000-0000-4000-8000-000000000001";
const MEMBERSHIP_ID: &str = "60000000-0000-4000-8000-000000000001";
const CONSULTATION_ID: &str = "70000000-0000-4000-8000-000000000001";
const BENCHMARK_ID: &str = "80000000-0000-4000-8000-000000000001";
const SCHEDULE_ID: &str = "90000000-0000-4000-8000-000000000001";

#[test]
fn clean_database_applies_v7_schedule_schema_and_history() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v7 migrations");

    let table: String = connection
        .query_row(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'schedules'",
            [],
            |row| row.get(0),
        )
        .expect("schedule table");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(table, "schedules");
    assert_eq!(history_count, MIGRATIONS.len() as i64);
    assert_eq!(
        MIGRATIONS.last().expect("v7 migration").name,
        "20260806060000_add_schedule"
    );
    verify_schedule_schema_for_test(&connection).expect("schedule schema contract");
}

#[test]
fn upgrades_v6_without_losing_existing_domain_rows() {
    let mut connection = Connection::open_in_memory().expect("v6 database");
    apply_for_test(&mut connection, &MIGRATIONS[..6]).expect("apply v6 migrations");
    insert_v6_rows(&connection);

    run(&mut connection).expect("upgrade to v7");
    for (table, id) in [
        ("customers", CUSTOMER_ID),
        ("insurance_policies", POLICY_ID),
        ("coverages", COVERAGE_ID),
        ("families", FAMILY_ID),
        ("family_memberships", MEMBERSHIP_ID),
        ("consultations", CONSULTATION_ID),
        ("coverage_benchmarks", BENCHMARK_ID),
    ] {
        let count: i64 = connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                [id],
                |row| row.get(0),
            )
            .expect("preserved v6 row");
        assert_eq!(count, 1, "{table} row must survive v7 upgrade");
    }
    let schedule_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM schedules", [], |row| row.get(0))
        .expect("schedule row count");
    assert_eq!(schedule_count, 0);
}

#[test]
fn refuses_drifted_v6_before_creating_schedule_table() {
    let mut connection = Connection::open_in_memory().expect("drifted v6 database");
    apply_for_test(&mut connection, &MIGRATIONS[..6]).expect("apply v6 migrations");
    connection
        .execute(
            "DROP INDEX coverage_benchmarks_deleted_at_category_id_gender_min_age_years_max_age_years_idx",
            [],
        )
        .expect("introduce v6 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema
             WHERE type = 'table' AND name = 'schedules'",
            [],
            |row| row.get(0),
        )
        .expect("schedule table count");
    assert_eq!(table_count, 0);
}

#[test]
fn schedule_migration_is_idempotent_and_preserves_rows() {
    let mut connection = Connection::open_in_memory().expect("schedule database");
    run(&mut connection).expect("first v7 run");
    connection
        .execute(
            "INSERT INTO schedules
             (id, title, scheduled_on, is_completed)
             VALUES (?1, '합성 일정', '2026-08-06', true)",
            [SCHEDULE_ID],
        )
        .expect("insert synthetic schedule");

    run(&mut connection).expect("second v7 run");
    let retained: (String, bool) = connection
        .query_row(
            "SELECT scheduled_on, is_completed FROM schedules WHERE id = ?1",
            [SCHEDULE_ID],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("retained schedule");
    assert_eq!(retained, ("2026-08-06".to_owned(), true));
}

#[test]
fn detects_schedule_column_index_and_foreign_key_drift() {
    let migration = MIGRATIONS[6].sql;
    let variants = [
        replace_once(
            migration,
            "\"scheduled_on\" TEXT NOT NULL",
            "\"scheduled_on\" DATETIME NOT NULL",
        ),
        replace_once(
            migration,
            "BOOLEAN NOT NULL DEFAULT false",
            "BOOLEAN NOT NULL DEFAULT true",
        ),
        replace_once(
            migration,
            "(\"scheduled_on\", \"deleted_at\")",
            "(\"deleted_at\", \"scheduled_on\")",
        ),
        migration.replace(
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("schedule drift database");
        for registered in &MIGRATIONS[..6] {
            connection
                .execute_batch(registered.sql)
                .expect("create v6 schema");
        }
        connection
            .execute_batch(&variant)
            .expect("create drifted schedule schema");
        assert_eq!(
            verify_schedule_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

fn insert_v6_rows(connection: &Connection) {
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
    connection
        .execute(
            "INSERT INTO coverage_benchmarks
             (id, category_id, gender, min_age_years, max_age_years,
              adequate_min_won, excessive_min_won)
             VALUES (?1, ?2, '합성성별', 20, 29, 100, 200)",
            params![BENCHMARK_ID, CATEGORY_ID],
        )
        .expect("insert benchmark");
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
