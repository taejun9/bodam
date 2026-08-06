use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, verify_unique_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    ("index", "families_deleted_at_name_idx", "families"),
    (
        "index",
        "family_memberships_customer_id_deleted_at_idx",
        "family_memberships",
    ),
    (
        "index",
        "family_memberships_family_id_customer_id_key",
        "family_memberships",
    ),
    (
        "index",
        "family_memberships_family_id_deleted_at_idx",
        "family_memberships",
    ),
    ("table", "families", "families"),
    ("table", "family_memberships", "family_memberships"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    verify_family_schema(connection)?;
    verify_membership_schema(connection)
}

fn verify_family_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("name", "TEXT", true, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] =
        &[("families_deleted_at_name_idx", &["deleted_at", "name"])];
    verify_columns(connection, "families", COLUMNS)?;
    verify_indexes(connection, "families", INDEXES)
}

fn verify_membership_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("family_id", "TEXT", true, None, 0),
        ("customer_id", "TEXT", true, None, 0),
        ("relationship_name", "TEXT", false, None, 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        (
            "family_memberships_family_id_deleted_at_idx",
            &["family_id", "deleted_at"],
        ),
        (
            "family_memberships_customer_id_deleted_at_idx",
            &["customer_id", "deleted_at"],
        ),
    ];
    const UNIQUE: &[(&str, &[&str])] = &[(
        "family_memberships_family_id_customer_id_key",
        &["family_id", "customer_id"],
    )];
    verify_columns(connection, "family_memberships", COLUMNS)?;
    verify_indexes(connection, "family_memberships", INDEXES)?;
    verify_unique_indexes(connection, "family_memberships", UNIQUE)?;
    verify_foreign_keys(connection)
}

fn verify_foreign_keys(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('family_memberships')
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
        foreign_key("customers", "customer_id"),
        foreign_key("families", "family_id"),
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
