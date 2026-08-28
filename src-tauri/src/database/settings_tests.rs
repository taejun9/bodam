use rusqlite::Connection;

use crate::error::AppError;

use super::migrations::{apply_for_test, run, verify_registered_prefix, MIGRATIONS};
use super::schema::{verify_settings_schema_for_test, verify_settings_v9_schema_for_test};

#[test]
fn clean_database_contains_v10_settings_singleton_defaults() {
    let mut connection = Connection::open_in_memory().expect("clean database");
    run(&mut connection).expect("apply v10 migrations");

    let settings: (i64, String, i64, i64, i64, Option<String>) = connection
        .query_row(
            "SELECT id, theme, recent_consultation_days, unconsulted_days,
                    dashboard_item_limit, custom_backup_directory
             FROM app_settings",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                ))
            },
        )
        .expect("settings singleton");
    assert_eq!(settings, (1, "light".into(), 30, 90, 10, None));
    assert_eq!(MIGRATIONS[8].name, "20260806080000_add_app_settings");
    assert_eq!(MIGRATIONS[9].name, "20260828000000_add_system_theme");
    assert_eq!(verify_registered_prefix(&connection), Ok(10));
    verify_settings_schema_for_test(&connection).expect("v10 settings schema contract");
}

#[test]
fn upgrades_v8_without_losing_existing_rows() {
    let mut connection = Connection::open_in_memory().expect("v8 database");
    apply_for_test(&mut connection, &MIGRATIONS[..8]).expect("apply v8 migrations");
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES ('synthetic-v8-customer', '합성 기존 고객')",
            [],
        )
        .expect("insert v8 row");

    run(&mut connection).expect("upgrade to v10");
    let customer_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM customers WHERE id = 'synthetic-v8-customer'",
            [],
            |row| row.get(0),
        )
        .expect("preserved customer");
    let settings_count: i64 = connection
        .query_row("SELECT COUNT(*) FROM app_settings", [], |row| row.get(0))
        .expect("settings count");
    assert_eq!((customer_count, settings_count), (1, 1));
}

#[test]
fn upgrades_registered_v9_prefix_without_changing_existing_settings() {
    let mut connection = Connection::open_in_memory().expect("v9 database");
    apply_for_test(&mut connection, &MIGRATIONS[..9]).expect("apply v9 migrations");
    connection
        .execute(
            "UPDATE app_settings SET theme = 'dark', recent_consultation_days = 45,
                    unconsulted_days = 120, dashboard_item_limit = 7,
                    custom_backup_directory = '/synthetic/backups',
                    created_at = '2026-08-06T00:00:00.000Z',
                    updated_at = '2026-08-07T00:00:00.000Z' WHERE id = 1",
            [],
        )
        .expect("seed v9 settings");

    assert_eq!(verify_registered_prefix(&connection), Ok(9));
    verify_settings_v9_schema_for_test(&connection).expect("v9 schema prefix");
    assert_eq!(
        verify_settings_schema_for_test(&connection),
        Err(AppError::MigrationDrift)
    );

    run(&mut connection).expect("upgrade v9 to v10");
    let retained: (String, i64, i64, i64, Option<String>, String, String) = connection
        .query_row(
            "SELECT theme, recent_consultation_days, unconsulted_days,
                    dashboard_item_limit, custom_backup_directory, created_at, updated_at
             FROM app_settings WHERE id = 1",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                    row.get(5)?,
                    row.get(6)?,
                ))
            },
        )
        .expect("retained v9 settings");
    assert_eq!(
        retained,
        (
            "dark".into(),
            45,
            120,
            7,
            Some("/synthetic/backups".into()),
            "2026-08-06T00:00:00.000Z".into(),
            "2026-08-07T00:00:00.000Z".into(),
        )
    );
    assert_eq!(verify_registered_prefix(&connection), Ok(10));
    verify_settings_schema_for_test(&connection).expect("v10 schema");
}

#[test]
fn refuses_drifted_v8_before_creating_settings_table() {
    let mut connection = Connection::open_in_memory().expect("drifted v8 database");
    apply_for_test(&mut connection, &MIGRATIONS[..8]).expect("apply v8 migrations");
    connection
        .execute("DROP INDEX schedules_customer_id_deleted_at_idx", [])
        .expect("introduce v8 drift");

    assert_eq!(run(&mut connection), Err(AppError::MigrationDrift));
    let table_count: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM sqlite_schema WHERE name = 'app_settings'",
            [],
            |row| row.get(0),
        )
        .expect("settings table count");
    assert_eq!(table_count, 0);
}

#[test]
fn settings_migration_is_idempotent_and_preserves_values() {
    let mut connection = Connection::open_in_memory().expect("settings database");
    run(&mut connection).expect("first v10 run");
    connection
        .execute(
            "UPDATE app_settings SET theme = 'system', recent_consultation_days = 45,
                    unconsulted_days = 120, dashboard_item_limit = 7,
                    custom_backup_directory = '/synthetic/backups' WHERE id = 1",
            [],
        )
        .expect("update settings");

    run(&mut connection).expect("second v10 run");
    let retained: (String, i64, i64, i64, Option<String>) = connection
        .query_row(
            "SELECT theme, recent_consultation_days, unconsulted_days,
                    dashboard_item_limit, custom_backup_directory FROM app_settings",
            [],
            |row| {
                Ok((
                    row.get(0)?,
                    row.get(1)?,
                    row.get(2)?,
                    row.get(3)?,
                    row.get(4)?,
                ))
            },
        )
        .expect("retained settings");
    assert_eq!(
        retained,
        (
            "system".into(),
            45,
            120,
            7,
            Some("/synthetic/backups".into())
        )
    );
}

#[test]
fn detects_settings_column_constraint_and_singleton_drift() {
    let migration = replace_once(
        MIGRATIONS[8].sql,
        "CHECK (\"theme\" IN ('light', 'dark'))",
        "CHECK (\"theme\" IN ('light', 'dark', 'system'))",
    );
    let variants = [
        replace_once(
            &migration,
            "\"theme\" TEXT NOT NULL",
            "\"theme\" INTEGER NOT NULL",
        ),
        replace_once(&migration, "DEFAULT 30", "DEFAULT 31"),
        replace_once(
            &migration,
            "CHECK (\"theme\" IN ('light', 'dark', 'system'))",
            "CHECK (\"theme\" IN ('light', 'dark'))",
        ),
        replace_once(
            &migration,
            "CHECK (\"dashboard_item_limit\" BETWEEN 1 AND 10)",
            "CHECK (\"dashboard_item_limit\" BETWEEN 0 AND 10)",
        ),
        replace_once(
            &migration,
            "length(\"custom_backup_directory\") > 0",
            "length(\"custom_backup_directory\") >= 0",
        ),
    ];

    for variant in variants {
        let connection = Connection::open_in_memory().expect("settings drift database");
        connection
            .execute_batch(&variant)
            .expect("create drifted settings schema");
        assert_eq!(
            verify_settings_schema_for_test(&connection),
            Err(AppError::MigrationDrift)
        );
    }

    let connection = Connection::open_in_memory().expect("missing singleton database");
    connection
        .execute_batch(&migration)
        .expect("create settings schema");
    connection
        .execute("DELETE FROM app_settings", [])
        .expect("remove singleton");
    assert_eq!(
        verify_settings_schema_for_test(&connection),
        Err(AppError::MigrationDrift)
    );
}

#[test]
fn versioned_schema_verifiers_distinguish_v9_and_v10_theme_checks() {
    let v9 = Connection::open_in_memory().expect("v9 schema database");
    v9.execute_batch(MIGRATIONS[8].sql)
        .expect("create v9 settings schema");
    verify_settings_v9_schema_for_test(&v9).expect("accept v9 schema");
    assert_eq!(
        verify_settings_schema_for_test(&v9),
        Err(AppError::MigrationDrift)
    );
    assert!(v9
        .execute("UPDATE app_settings SET theme = 'system'", [])
        .is_err());

    let mut v10 = Connection::open_in_memory().expect("v10 schema database");
    apply_for_test(&mut v10, &MIGRATIONS[..10]).expect("create v10 schema");
    verify_settings_schema_for_test(&v10).expect("accept v10 schema");
    assert_eq!(
        verify_settings_v9_schema_for_test(&v10),
        Err(AppError::MigrationDrift)
    );
}

#[test]
fn database_checks_reject_invalid_settings_values() {
    let mut connection = Connection::open_in_memory().expect("settings checks database");
    run(&mut connection).expect("apply v10 migrations");
    connection
        .execute("UPDATE app_settings SET theme = 'system'", [])
        .expect("accept system theme");
    for statement in [
        "UPDATE app_settings SET id = 2",
        "UPDATE app_settings SET theme = 'automatic'",
        "UPDATE app_settings SET recent_consultation_days = 0",
        "UPDATE app_settings SET unconsulted_days = 3660",
        "UPDATE app_settings SET recent_consultation_days = 100, unconsulted_days = 99",
        "UPDATE app_settings SET dashboard_item_limit = 11",
        "UPDATE app_settings SET custom_backup_directory = ''",
    ] {
        assert!(
            connection.execute(statement, []).is_err(),
            "must reject {statement}"
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
