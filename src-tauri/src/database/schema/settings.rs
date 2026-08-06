use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[("table", "app_settings", "app_settings")];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
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
    verify_checks(connection)?;
    verify_singleton(connection)
}

fn verify_checks(connection: &Connection) -> Result<(), AppError> {
    const REQUIRED: &[&str] = &[
        "CHECK (\"id\" = 1)",
        "CHECK (\"theme\" IN ('light', 'dark'))",
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
    if REQUIRED.iter().any(|required| !sql.contains(required)) {
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
