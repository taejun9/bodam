use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[(
    "table",
    "insurance_policy_import_sources",
    "insurance_policy_import_sources",
)];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("policy_id", "TEXT", true, None, 1),
        ("no", "TEXT", false, None, 0),
        ("collection_reflected_on", "TEXT", false, None, 0),
        ("affiliation", "TEXT", false, None, 0),
        ("manager", "TEXT", false, None, 0),
        ("collection_code", "TEXT", false, None, 0),
        ("contract", "TEXT", false, None, 0),
        ("insurer", "TEXT", false, None, 0),
        ("product_name", "TEXT", false, None, 0),
        ("policy_number", "TEXT", false, None, 0),
        ("contracted_on", "TEXT", false, None, 0),
        ("status", "TEXT", false, None, 0),
        ("final_payment_month", "TEXT", false, None, 0),
        ("payment_sequence", "TEXT", false, None, 0),
        ("payment_premium", "TEXT", false, None, 0),
        ("contractor", "TEXT", false, None, 0),
        ("insured", "TEXT", false, None, 0),
        ("coverage_starts_on", "TEXT", false, None, 0),
        ("coverage_ends_on", "TEXT", false, None, 0),
        ("collection_method", "TEXT", false, None, 0),
        ("payment_term", "TEXT", false, None, 0),
        ("original_recruiter_name", "TEXT", false, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
    ];
    verify_columns(connection, "insurance_policy_import_sources", COLUMNS)?;
    verify_foreign_key(connection)
}

fn verify_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('insurance_policy_import_sources') ORDER BY id, seq",
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
        "insurance_policies".to_owned(),
        "policy_id".to_owned(),
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
