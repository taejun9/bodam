use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, ExpectedColumn};

pub(super) const V9_OBJECTS: &[(&str, &str, &str)] = &[("table", "app_settings", "app_settings")];
pub(super) const V10_OBJECTS: &[(&str, &str, &str)] = &[];

pub(super) fn verify_v9_schema(connection: &Connection) -> Result<(), AppError> {
    verify_schema(
        connection,
        "CHECK (\"theme\" IN ('light', 'dark'))",
        "CHECK (\"theme\" IN ('light', 'dark', 'system'))",
    )
}

pub(super) fn verify_current_schema(connection: &Connection) -> Result<(), AppError> {
    verify_schema(
        connection,
        "CHECK (\"theme\" IN ('light', 'dark', 'system'))",
        "CHECK (\"theme\" IN ('light', 'dark'))",
    )
}

fn verify_schema(
    connection: &Connection,
    required_theme_check: &str,
    rejected_theme_check: &str,
) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "INTEGER", true, Some("1"), 1),
        ("theme", "TEXT", true, Some("'light'"), 0),
        ("recent_consultation_days", "INTEGER", true, Some("30"), 0),
        ("unconsulted_days", "INTEGER", true, Some("90"), 0),
        ("dashboard_item_limit", "INTEGER", true, Some("10"), 0),
        ("custom_backup_directory", "TEXT", false, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
    ];
    verify_columns(connection, "app_settings", COLUMNS)?;
    verify_checks(connection, required_theme_check, rejected_theme_check)?;
    verify_singleton(connection)
}

fn verify_checks(
    connection: &Connection,
    required_theme_check: &str,
    rejected_theme_check: &str,
) -> Result<(), AppError> {
    const REQUIRED: &[&str] = &[
        "CHECK (\"id\" = 1)",
        "CHECK (\"recent_consultation_days\" BETWEEN 1 AND 365)",
        "CHECK (\"unconsulted_days\" BETWEEN 1 AND 3650)",
        "CHECK (\"unconsulted_days\" >= \"recent_consultation_days\")",
        "CHECK (\"dashboard_item_limit\" BETWEEN 1 AND 10)",
        "CHECK (\"custom_backup_directory\" IS NULL OR length(\"custom_backup_directory\") > 0)",
    ];
    let sql = connection
        .query_row(
            "SELECT sql FROM sqlite_schema WHERE type = 'table' AND name = 'app_settings'",
            [],
            |row| row.get::<_, String>(0),
        )
        .map_err(|_| AppError::MigrationDrift)?;
    if !sql.contains(required_theme_check)
        || sql.contains(rejected_theme_check)
        || REQUIRED.iter().any(|required| !sql.contains(required))
    {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn verify_singleton(connection: &Connection) -> Result<(), AppError> {
    let (count, matching): (i64, i64) = connection
        .query_row(
            "SELECT COUNT(*), COUNT(*) FILTER (WHERE id = 1) FROM app_settings",
            [],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .map_err(|_| AppError::MigrationDrift)?;
    if (count, matching) != (1, 1) {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}
