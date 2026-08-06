use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_family_schema_for_test;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const COVERAGE_ID: &str = "40000000-0000-4000-8000-000000000001";
const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";

#[test]
fn clean_database_applies_v4_family_schema_and_history() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v4 migrations");

    for table in ["families", "family_memberships"] {
        let found: String = connection
            .query_row(
                "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .expect("family table");
        assert_eq!(found, table);
    }
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("history count");
    assert_eq!(history_count, MIGRATIONS.len() as i64);
    verify_family_schema_for_test(&connection).expect("family schema contract");
}

#[test]
fn upgrades_v3_without_losing_existing_domain_rows() {
    let mut connection = Connection::open_in_memory().expect("v3 database");
    apply_for_test(&mut connection, &MIGRATIONS[..3]).expect("apply v3 migrations");
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, ?2)",
            params![CUSTOMER_ID, "합성 기존 고객"],
        )
        .expect("insert customer");
    connection
        .execute(
            "INSERT INTO insurance_policies
             (id, customer_id, insurer, product_name, monthly_premium_won)
             VALUES (?1, ?2, ?3, ?4, 1000)",
            params![POLICY_ID, CUSTOMER_ID, "합성보험사", "합성상품"],
        )
        .expect("insert policy");
    connection
        .execute(
            "INSERT INTO coverages (id, policy_id, category_id, amount_won)
             VALUES (?1, ?2, ?3, 5000)",
            params![COVERAGE_ID, POLICY_ID, CATEGORY_ID],
        )
        .expect("insert coverage");

    run(&mut connection).expect("upgrade to v4");
    for (table, id) in [
        ("customers", CUSTOMER_ID),
        ("insurance_policies", POLICY_ID),
        ("coverages", COVERAGE_ID),
        ("coverage_categories", CATEGORY_ID),
    ] {
        let count: i64 = connection
            .query_row(
                &format!("SELECT COUNT(*) FROM {table} WHERE id = ?1"),
                [id],
                |row| row.get(0),
            )
            .expect("preserved row");
        assert_eq!(count, 1, "{table} row must survive v4 upgrade");
    }
}

#[test]
fn refuses_drifted_v3_before_creating_family_tables() {
    let mut connection = Connection::open_in_memory().expect("drifted v3 database");
    apply_for_test(&mut connection, &MIGRATIONS[..3]).expect("apply v3 migrations");
    connection
        .execute("DROP INDEX coverages_policy_id_deleted_at_idx", [])
        .expect("introduce v3 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let family_tables: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema
             WHERE type = 'table' AND name IN ('families', 'family_memberships')",
            [],
            |row| row.get(0),
        )
        .expect("family table count");
    assert_eq!(family_tables, 0);
}

#[test]
fn detects_family_column_index_unique_and_foreign_key_drift() {
    let migration = MIGRATIONS[3].sql;
    let variants = [
        replace_once(
            migration,
            "\"relationship_name\" TEXT",
            "\"relationship_name\" INTEGER",
        ),
        replace_once(
            migration,
            "(\"deleted_at\", \"name\")",
            "(\"name\", \"deleted_at\")",
        ),
        replace_once(
            migration,
            "CREATE UNIQUE INDEX \"family_memberships_family_id_customer_id_key\"",
            "CREATE INDEX \"family_memberships_family_id_customer_id_key\"",
        ),
        replace_once(
            migration,
            "(\"family_id\", \"customer_id\")",
            "(\"customer_id\", \"family_id\")",
        ),
        migration.replacen(
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
            1,
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("family drift database");
        for migration in &MIGRATIONS[..3] {
            connection
                .execute_batch(migration.sql)
                .expect("create v3 schema");
        }
        connection
            .execute_batch(&variant)
            .expect("create drifted family schema");
        assert_eq!(
            verify_family_schema_for_test(&connection),
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
