use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    (
        "index",
        "insurance_policies_customer_id_deleted_at_idx",
        "insurance_policies",
    ),
    (
        "index",
        "insurance_policies_matures_on_deleted_at_idx",
        "insurance_policies",
    ),
    ("table", "insurance_policies", "insurance_policies"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("customer_id", "TEXT", true, None, 0),
        ("insurer", "TEXT", true, None, 0),
        ("product_name", "TEXT", true, None, 0),
        ("joined_on", "TEXT", false, None, 0),
        ("coverage_term", "TEXT", false, None, 0),
        ("payment_term", "TEXT", false, None, 0),
        ("monthly_premium_won", "BIGINT", true, None, 0),
        ("disclosure_plan", "TEXT", false, None, 0),
        ("matures_on", "TEXT", false, None, 0),
        ("renewable", "BOOLEAN", true, Some("false"), 0),
        ("status", "TEXT", false, None, 0),
        ("is_included", "BOOLEAN", true, Some("true"), 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        (
            "insurance_policies_customer_id_deleted_at_idx",
            &["customer_id", "deleted_at"],
        ),
        (
            "insurance_policies_matures_on_deleted_at_idx",
            &["matures_on", "deleted_at"],
        ),
    ];
    verify_columns(connection, "insurance_policies", COLUMNS)?;
    verify_indexes(connection, "insurance_policies", INDEXES)?;
    verify_foreign_key(connection)
}

fn verify_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('insurance_policies') ORDER BY id, seq",
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
