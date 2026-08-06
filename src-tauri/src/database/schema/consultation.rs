use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    (
        "index",
        "consultations_customer_id_deleted_at_consulted_at_idx",
        "consultations",
    ),
    ("table", "consultations", "consultations"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("customer_id", "TEXT", true, None, 0),
        ("consulted_at", "DATETIME", true, None, 0),
        ("content", "TEXT", false, None, 0),
        ("next_contact_on", "TEXT", false, None, 0),
        ("result", "TEXT", false, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[(
        "consultations_customer_id_deleted_at_consulted_at_idx",
        &["customer_id", "deleted_at", "consulted_at"],
    )];
    verify_columns(connection, "consultations", COLUMNS)?;
    verify_indexes(connection, "consultations", INDEXES)?;
    verify_foreign_key(connection)
}

fn verify_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('consultations') ORDER BY id, seq",
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
