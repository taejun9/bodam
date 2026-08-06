use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    ("index", "schedules_customer_id_deleted_at_idx", "schedules"),
    (
        "index",
        "schedules_scheduled_on_deleted_at_idx",
        "schedules",
    ),
    ("table", "schedules", "schedules"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("customer_id", "TEXT", false, None, 0),
        ("title", "TEXT", true, None, 0),
        ("scheduled_on", "TEXT", true, None, 0),
        ("scheduled_time", "TEXT", false, None, 0),
        ("memo", "TEXT", false, None, 0),
        ("is_completed", "BOOLEAN", true, Some("false"), 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        (
            "schedules_scheduled_on_deleted_at_idx",
            &["scheduled_on", "deleted_at"],
        ),
        (
            "schedules_customer_id_deleted_at_idx",
            &["customer_id", "deleted_at"],
        ),
    ];
    verify_columns(connection, "schedules", COLUMNS)?;
    verify_indexes(connection, "schedules", INDEXES)?;
    verify_foreign_key(connection)
}

fn verify_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('schedules') ORDER BY id, seq",
        )
        .map_err(|_| AppError::MigrationDrift)?;
    let keys = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|_| AppError::MigrationDrift)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::MigrationDrift)?;
    let expected = vec![(
        "customers".to_owned(),
        "customer_id".to_owned(),
        "id".to_owned(),
        "CASCADE".to_owned(),
        "RESTRICT".to_owned(),
        "NONE".to_owned(),
    )];
    if keys != expected {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}
