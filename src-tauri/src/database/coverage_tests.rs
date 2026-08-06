use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, run, MIGRATIONS};
use super::schema::verify_coverage_schema_for_test;

const CUSTOMER_ID: &str = "20000000-0000-4000-8000-000000000001";
const POLICY_ID: &str = "30000000-0000-4000-8000-000000000001";
const SEEDS: &[(&str, &str)] = &[
    ("10000000-0000-4000-8000-000000000001", "암"),
    ("10000000-0000-4000-8000-000000000002", "유사암"),
    ("10000000-0000-4000-8000-000000000003", "뇌혈관"),
    ("10000000-0000-4000-8000-000000000004", "심혈관"),
    ("10000000-0000-4000-8000-000000000005", "질병수술"),
    ("10000000-0000-4000-8000-000000000006", "상해수술"),
    ("10000000-0000-4000-8000-000000000007", "후유장해"),
    ("10000000-0000-4000-8000-000000000008", "입원"),
    ("10000000-0000-4000-8000-000000000009", "간병"),
    ("10000000-0000-4000-8000-000000000010", "운전자"),
];

#[test]
fn clean_database_applies_v3_and_seeds_categories_once() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v3 migrations");

    assert_eq!(category_rows(&connection), owned_seeds());
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("migration history count");
    assert_eq!(history_count, 3);
    verify_coverage_schema_for_test(&connection).expect("coverage schema contract");

    run(&mut connection).expect("idempotent migration run");
    assert_eq!(category_rows(&connection), owned_seeds());
}

#[test]
fn upgrades_v2_without_losing_customer_or_policy_rows() {
    let mut connection = Connection::open_in_memory().expect("v2 database");
    apply_for_test(&mut connection, &MIGRATIONS[..2]).expect("apply v2 migrations");
    insert_customer_and_policy(&connection);

    run(&mut connection).expect("upgrade to v3");
    for table in ["customers", "insurance_policies"] {
        let count: i64 = connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .expect("preserved row count");
        assert_eq!(count, 1, "{table} row must survive v3 upgrade");
    }
    assert_eq!(category_rows(&connection), owned_seeds());
}

#[test]
fn migration_does_not_restore_renamed_or_deleted_seed_rows() {
    let mut connection = Connection::open_in_memory().expect("seed lifecycle database");
    run(&mut connection).expect("apply v3 migrations");
    connection
        .execute(
            "UPDATE coverage_categories SET name = ?2 WHERE id = ?1",
            params![SEEDS[0].0, "합성 수정 카테고리"],
        )
        .expect("rename seed");
    connection
        .execute(
            "UPDATE coverage_categories SET deleted_at = CURRENT_TIMESTAMP WHERE id = ?1",
            [SEEDS[1].0],
        )
        .expect("soft delete seed");

    run(&mut connection).expect("reopen migrated database");
    let renamed: String = connection
        .query_row(
            "SELECT name FROM coverage_categories WHERE id = ?1",
            [SEEDS[0].0],
            |row| row.get(0),
        )
        .expect("renamed seed");
    let deleted_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverage_categories WHERE id = ?1 AND deleted_at IS NOT NULL",
            [SEEDS[1].0],
            |row| row.get(0),
        )
        .expect("deleted seed");
    assert_eq!(renamed, "합성 수정 카테고리");
    assert_eq!(deleted_count, 1);
    assert_eq!(category_rows(&connection).len(), 10);
}

#[test]
fn refuses_drifted_v2_before_creating_coverage_tables() {
    let mut connection = Connection::open_in_memory().expect("drifted v2 database");
    apply_for_test(&mut connection, &MIGRATIONS[..2]).expect("apply v2 migrations");
    connection
        .execute(
            "DROP INDEX insurance_policies_matures_on_deleted_at_idx",
            [],
        )
        .expect("introduce v2 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let coverage_tables: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema
             WHERE type = 'table' AND name IN ('coverage_categories', 'coverages')",
            [],
            |row| row.get(0),
        )
        .expect("coverage table count");
    assert_eq!(coverage_tables, 0);
}

#[test]
fn detects_coverage_column_index_and_foreign_key_drift() {
    let migration = MIGRATIONS[2].sql;
    let variants = [
        replace_once(
            migration,
            "\"amount_won\" BIGINT NOT NULL",
            "\"amount_won\" REAL NOT NULL",
        ),
        replace_once(
            migration,
            "(\"policy_id\", \"deleted_at\")",
            "(\"deleted_at\", \"policy_id\")",
        ),
        migration.replacen(
            "ON DELETE RESTRICT ON UPDATE CASCADE",
            "ON DELETE CASCADE ON UPDATE CASCADE",
            1,
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("coverage drift database");
        connection
            .execute_batch(MIGRATIONS[0].sql)
            .expect("create customer schema");
        connection
            .execute_batch(MIGRATIONS[1].sql)
            .expect("create policy schema");
        connection
            .execute_batch(&variant)
            .expect("create drifted coverage schema");
        assert_eq!(
            verify_coverage_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

fn category_rows(connection: &Connection) -> Vec<(String, String)> {
    let mut statement = connection
        .prepare("SELECT id, name FROM coverage_categories ORDER BY id")
        .expect("category statement");
    statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .expect("category query")
        .collect::<Result<Vec<_>, _>>()
        .expect("category rows")
}

fn owned_seeds() -> Vec<(String, String)> {
    SEEDS
        .iter()
        .map(|(id, name)| ((*id).to_owned(), (*name).to_owned()))
        .collect()
}

fn insert_customer_and_policy(connection: &Connection) {
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, ?2)",
            params![CUSTOMER_ID, "합성 기존 고객"],
        )
        .expect("insert v2 customer");
    connection
        .execute(
            "INSERT INTO insurance_policies
             (id, customer_id, insurer, product_name, monthly_premium_won)
             VALUES (?1, ?2, ?3, ?4, 1000)",
            params![POLICY_ID, CUSTOMER_ID, "합성보험사", "합성상품"],
        )
        .expect("insert v2 policy");
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
