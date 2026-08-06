use rusqlite::Connection;

use crate::error::AppError;

type ExpectedColumn = (&'static str, &'static str, bool, Option<&'static str>, i64);

#[derive(Debug, PartialEq, Eq)]
struct ActualColumn {
    name: String,
    declared_type: String,
    not_null: bool,
    default_value: Option<String>,
    primary_key_position: i64,
}

const EXPECTED_RUNTIME_OBJECTS: &[(&str, &str, &str)] = &[
    ("index", "customers_deleted_at_idx", "customers"),
    ("index", "customers_is_managed_deleted_at_idx", "customers"),
    ("index", "customers_name_deleted_at_idx", "customers"),
    ("index", "customers_status_deleted_at_idx", "customers"),
    ("table", "customers", "customers"),
];

pub(super) fn has_application_objects(connection: &Connection) -> Result<bool, AppError> {
    Ok(!runtime_objects(connection)?.is_empty())
}

pub(super) fn verify_runtime_objects(connection: &Connection) -> Result<(), AppError> {
    let expected = EXPECTED_RUNTIME_OBJECTS
        .iter()
        .map(|(kind, name, table)| ((*kind).to_owned(), (*name).to_owned(), (*table).to_owned()))
        .collect::<Vec<_>>();
    if runtime_objects(connection)? != expected {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

pub(super) fn verify_history_table(connection: &Connection) -> Result<(), AppError> {
    const EXPECTED: &[ExpectedColumn] = &[
        ("migration_name", "TEXT", true, None, 1),
        ("checksum_sha256", "TEXT", true, None, 0),
        ("applied_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
    ];
    verify_columns(connection, "bodam_schema_migrations", EXPECTED)
}

pub(super) fn verify_customer_schema(connection: &Connection) -> Result<(), AppError> {
    const EXPECTED_COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("name", "TEXT", true, None, 0),
        ("birth_date", "TEXT", false, None, 0),
        ("gender", "TEXT", false, None, 0),
        ("phone", "TEXT", false, None, 0),
        ("address", "TEXT", false, None, 0),
        ("memo", "TEXT", false, None, 0),
        ("status", "TEXT", false, None, 0),
        ("is_managed", "BOOLEAN", true, Some("true"), 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const REQUIRED_INDEXES: &[(&str, &[&str])] = &[
        ("customers_deleted_at_idx", &["deleted_at"]),
        ("customers_name_deleted_at_idx", &["name", "deleted_at"]),
        ("customers_status_deleted_at_idx", &["status", "deleted_at"]),
        (
            "customers_is_managed_deleted_at_idx",
            &["is_managed", "deleted_at"],
        ),
    ];

    verify_columns(connection, "customers", EXPECTED_COLUMNS)?;
    let mut statement = connection
        .prepare("PRAGMA index_list('customers')")
        .map_err(|_| AppError::Migration)?;
    let indexes = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(1)?,
                row.get::<_, i64>(2)? != 0,
                row.get::<_, i64>(4)? != 0,
            ))
        })
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    for (required_name, required_columns) in REQUIRED_INDEXES {
        let attributes = indexes
            .iter()
            .find(|(name, _, _)| name == required_name)
            .map(|(_, unique, partial)| (*unique, *partial));
        if attributes != Some((false, false))
            || index_columns(connection, required_name)? != *required_columns
        {
            return Err(AppError::MigrationDrift);
        }
    }
    Ok(())
}

fn runtime_objects(connection: &Connection) -> Result<Vec<(String, String, String)>, AppError> {
    let mut statement = connection
        .prepare(
            "SELECT type, name, tbl_name FROM sqlite_schema
             WHERE type IN ('table', 'index', 'view', 'trigger')
               AND name NOT GLOB 'sqlite_*'
               AND name <> 'bodam_schema_migrations'
             ORDER BY type, name, tbl_name",
        )
        .map_err(|_| AppError::Migration)?;
    let objects = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)))
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    Ok(objects)
}

fn verify_columns(
    connection: &Connection,
    table: &str,
    expected: &[ExpectedColumn],
) -> Result<(), AppError> {
    let mut statement = connection
        .prepare("SELECT name, type, \"notnull\", dflt_value, pk FROM pragma_table_info(?1)")
        .map_err(|_| AppError::Migration)?;
    let columns = statement
        .query_map([table], |row| {
            Ok(ActualColumn {
                name: row.get(0)?,
                declared_type: row.get(1)?,
                not_null: row.get::<_, i64>(2)? != 0,
                default_value: row.get(3)?,
                primary_key_position: row.get(4)?,
            })
        })
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    if columns.len() != expected.len()
        || columns
            .iter()
            .zip(expected)
            .any(|(actual, expected)| !column_matches(actual, expected))
    {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn column_matches(actual: &ActualColumn, expected: &ExpectedColumn) -> bool {
    actual.name == expected.0
        && actual.declared_type == expected.1
        && actual.not_null == expected.2
        && actual.default_value.as_deref() == expected.3
        && actual.primary_key_position == expected.4
}

fn index_columns(connection: &Connection, index_name: &str) -> Result<Vec<String>, AppError> {
    let mut statement = connection
        .prepare("SELECT name FROM pragma_index_info(?1) ORDER BY seqno")
        .map_err(|_| AppError::Migration)?;
    let columns = statement
        .query_map([index_name], |row| row.get::<_, String>(0))
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    Ok(columns)
}

#[cfg(test)]
pub(super) fn verify_customer_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    verify_customer_schema(connection)
}
