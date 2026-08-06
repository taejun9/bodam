use rusqlite::{params, Connection};

use crate::error::AppError;

use super::migrations::{apply_for_test, checksum_for_test, run, Migration, MIGRATIONS};
use super::schema::verify_customer_schema_for_test;

#[test]
fn initial_migration_creates_schema_and_history() {
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    run(&mut connection).expect("apply initial migration");

    let customer_table: String = connection
        .query_row(
            "SELECT name FROM sqlite_schema WHERE type = 'table' AND name = 'customers'",
            [],
            |row| row.get(0),
        )
        .expect("customer table");
    assert_eq!(customer_table, "customers");

    let (migration_name, checksum): (String, String) = connection
        .query_row(
            "SELECT migration_name, checksum_sha256 FROM bodam_schema_migrations",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("migration history");
    assert_eq!(migration_name, MIGRATIONS[0].name);
    assert_eq!(checksum, checksum_for_test(MIGRATIONS[0].sql));
    assert_eq!(checksum, MIGRATIONS[0].checksum_sha256);
    assert_eq!(checksum.len(), 64);
}

#[test]
fn migration_is_idempotent_and_preserves_existing_synthetic_rows() {
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    run(&mut connection).expect("first migration run");
    connection
        .execute(
            r#"INSERT INTO customers
               (id, name, is_managed, created_at, updated_at)
               VALUES (?1, ?2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)"#,
            params!["synthetic-existing-id", "Synthetic Existing"],
        )
        .expect("insert synthetic fixture");

    run(&mut connection).expect("second migration run");
    let row_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM customers", [], |row| row.get(0))
        .expect("count customers");
    let history_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM bodam_schema_migrations", [], |row| {
            row.get(0)
        })
        .expect("count migrations");
    assert_eq!(row_count, 1);
    assert_eq!(history_count, MIGRATIONS.len() as i64);
}

#[test]
fn detects_history_and_runtime_schema_drift() {
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    run(&mut connection).expect("initial migration");
    connection
        .execute(
            "UPDATE bodam_schema_migrations SET checksum_sha256 = 'changed'",
            [],
        )
        .expect("alter migration metadata");
    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));

    for migration in MIGRATIONS {
        connection
            .execute(
                "UPDATE bodam_schema_migrations SET checksum_sha256 = ?2 WHERE migration_name = ?1",
                params![migration.name, migration.checksum_sha256],
            )
            .expect("restore migration metadata");
    }
    connection
        .execute("DROP INDEX customers_deleted_at_idx", [])
        .expect("alter runtime schema");
    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
}

#[test]
fn rejects_missing_and_extra_history_rows() {
    let mut missing = Connection::open_in_memory().expect("missing history database");
    run(&mut missing).expect("initial migration");
    missing
        .execute("DELETE FROM bodam_schema_migrations", [])
        .expect("remove registered history");
    assert_eq!(run(&mut missing), Err(AppError::MigrationDrift));

    let mut extra = Connection::open_in_memory().expect("extra history database");
    run(&mut extra).expect("initial migration");
    extra
        .execute(
            "INSERT INTO bodam_schema_migrations (migration_name, checksum_sha256) VALUES (?1, ?2)",
            params!["synthetic_unregistered", "not-registered"],
        )
        .expect("insert unregistered history");
    assert_eq!(run(&mut extra), Err(AppError::MigrationDrift));
}

#[test]
fn rejects_reordered_history_rows() {
    static ORDERED: &[Migration] = &[
        Migration {
            name: "synthetic_one",
            checksum_sha256: "2f4e8fa03fe200511a4e4604fd3b3da90546ee69ded83f092cc91a724a0d8abc",
            sql: "CREATE TABLE synthetic_one (id TEXT);",
        },
        Migration {
            name: "synthetic_two",
            checksum_sha256: "2df19d7d282e45c441d9bf49ac78d689cac5d3277e297f0f1504813e5a0f48f6",
            sql: "CREATE TABLE synthetic_two (id TEXT);",
        },
    ];
    let mut connection = Connection::open_in_memory().expect("ordered history database");
    apply_for_test(&mut connection, ORDERED).expect("apply ordered migrations");
    connection
        .execute("DELETE FROM bodam_schema_migrations", [])
        .expect("clear history");
    for migration in ORDERED.iter().rev() {
        connection
            .execute(
                "INSERT INTO bodam_schema_migrations (migration_name, checksum_sha256) VALUES (?1, ?2)",
                params![migration.name, migration.checksum_sha256],
            )
            .expect("insert reordered history");
    }
    assert_eq!(
        apply_for_test(&mut connection, ORDERED),
        Err(AppError::MigrationDrift)
    );
}

#[test]
fn rejects_unregistered_runtime_tables_and_indexes() {
    for rogue_sql in [
        "CREATE TABLE rogue_records (id TEXT);",
        "CREATE INDEX rogue_customer_idx ON customers(memo);",
    ] {
        let mut connection = Connection::open_in_memory().expect("runtime drift database");
        run(&mut connection).expect("initial migration");
        connection
            .execute_batch(rogue_sql)
            .expect("create unregistered object");
        assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    }
}

#[test]
fn rejects_history_table_contract_drift() {
    let mut connection = Connection::open_in_memory().expect("history drift database");
    connection
        .execute_batch(
            "CREATE TABLE bodam_schema_migrations (
                migration_name TEXT PRIMARY KEY,
                checksum_sha256 TEXT NOT NULL,
                applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                rogue TEXT
            );",
        )
        .expect("create drifted history table");
    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
}

#[test]
fn failed_migration_rolls_back_its_schema_changes() {
    static BROKEN: &[Migration] = &[Migration {
        name: "synthetic_broken",
        checksum_sha256: "0f56c957163f652f2e101c3cf53bfb0bc7954307d7b3c19101c52740ff85a264",
        sql: "CREATE TABLE synthetic_partial (id TEXT); INVALID SQL;",
    }];
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    assert_eq!(
        apply_for_test(&mut connection, BROKEN),
        Err(AppError::Migration)
    );
    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema WHERE type = 'table' AND name = 'synthetic_partial'",
            [],
            |row| row.get(0),
        )
        .expect("inspect rollback");
    assert_eq!(table_count, 0);
}

#[test]
fn detects_column_contract_and_index_order_drift() {
    let migration = MIGRATIONS[0].sql;
    let variants = [
        replace_once(
            migration,
            "\"name\" TEXT NOT NULL",
            "\"name\" INTEGER NOT NULL",
        ),
        replace_once(migration, "\"name\" TEXT NOT NULL", "\"name\" TEXT"),
        replace_once(
            migration,
            "BOOLEAN NOT NULL DEFAULT true",
            "BOOLEAN NOT NULL DEFAULT false",
        ),
        replace_once(
            migration,
            "\"id\" TEXT NOT NULL PRIMARY KEY",
            "\"id\" TEXT NOT NULL",
        ),
        replace_once(
            migration,
            "(\"name\", \"deleted_at\")",
            "(\"deleted_at\", \"name\")",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("in-memory drift database");
        connection
            .execute_batch(&variant)
            .expect("create drifted synthetic schema");
        assert_eq!(
            verify_customer_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }
}

#[test]
fn rejects_registered_migration_when_declared_hash_is_wrong() {
    static WRONG_HASH: &[Migration] = &[Migration {
        name: "synthetic_hash_drift",
        checksum_sha256: "0000000000000000000000000000000000000000000000000000000000000000",
        sql: "CREATE TABLE synthetic_hash_drift (id TEXT);",
    }];
    let mut connection = Connection::open_in_memory().expect("in-memory database");
    assert_eq!(
        apply_for_test(&mut connection, WRONG_HASH),
        Err(AppError::MigrationDrift)
    );
}

fn replace_once(source: &str, from: &str, to: &str) -> String {
    assert_eq!(
        source.matches(from).count(),
        1,
        "fixture token must be unique"
    );
    source.replacen(from, to, 1)
}
