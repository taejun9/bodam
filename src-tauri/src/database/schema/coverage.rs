use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    (
        "index",
        "coverage_categories_deleted_at_name_idx",
        "coverage_categories",
    ),
    ("index", "coverages_category_id_deleted_at_idx", "coverages"),
    ("index", "coverages_policy_id_deleted_at_idx", "coverages"),
    ("table", "coverage_categories", "coverage_categories"),
    ("table", "coverages", "coverages"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    verify_category_schema(connection)?;
    verify_coverage_schema(connection)
}

fn verify_category_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("name", "TEXT", true, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[(
        "coverage_categories_deleted_at_name_idx",
        &["deleted_at", "name"],
    )];
    verify_columns(connection, "coverage_categories", COLUMNS)?;
    verify_indexes(connection, "coverage_categories", INDEXES)
}

fn verify_coverage_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("policy_id", "TEXT", true, None, 0),
        ("category_id", "TEXT", true, None, 0),
        ("amount_won", "BIGINT", true, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        (
            "coverages_policy_id_deleted_at_idx",
            &["policy_id", "deleted_at"],
        ),
        (
            "coverages_category_id_deleted_at_idx",
            &["category_id", "deleted_at"],
        ),
    ];
    verify_columns(connection, "coverages", COLUMNS)?;
    verify_indexes(connection, "coverages", INDEXES)?;
    verify_foreign_keys(connection)
}

fn verify_foreign_keys(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('coverages')
             ORDER BY \"table\", \"from\", \"to\"",
        )
        .map_err(|_| AppError::Migration)?;
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
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    let expected = vec![
        foreign_key("coverage_categories", "category_id"),
        foreign_key("insurance_policies", "policy_id"),
    ];
    if keys != expected {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn foreign_key(table: &str, from: &str) -> (String, String, String, String, String, String) {
    (
        table.to_owned(),
        from.to_owned(),
        "id".to_owned(),
        "CASCADE".to_owned(),
        "RESTRICT".to_owned(),
        "NONE".to_owned(),
    )
}
