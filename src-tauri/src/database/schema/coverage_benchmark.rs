use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    (
        "index",
        "coverage_benchmarks_deleted_at_category_id_gender_min_age_years_max_age_years_idx",
        "coverage_benchmarks",
    ),
    ("table", "coverage_benchmarks", "coverage_benchmarks"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("category_id", "TEXT", true, None, 0),
        ("gender", "TEXT", true, None, 0),
        ("min_age_years", "INTEGER", true, None, 0),
        ("max_age_years", "INTEGER", true, None, 0),
        ("adequate_min_won", "BIGINT", true, None, 0),
        ("excessive_min_won", "BIGINT", true, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[(
        "coverage_benchmarks_deleted_at_category_id_gender_min_age_years_max_age_years_idx",
        &[
            "deleted_at",
            "category_id",
            "gender",
            "min_age_years",
            "max_age_years",
        ],
    )];
    verify_columns(connection, "coverage_benchmarks", COLUMNS)?;
    verify_indexes(connection, "coverage_benchmarks", INDEXES)?;
    verify_foreign_key(connection)
}

fn verify_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('coverage_benchmarks') ORDER BY id, seq",
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
    let expected = vec![(
        "coverage_categories".to_owned(),
        "category_id".to_owned(),
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
