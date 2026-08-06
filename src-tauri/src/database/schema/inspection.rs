use rusqlite::Connection;

use crate::error::AppError;

pub(super) type ExpectedColumn = (&'static str, &'static str, bool, Option<&'static str>, i64);
pub(super) type ExpectedIndex = (&'static str, &'static [&'static str]);

#[derive(Debug, PartialEq, Eq)]
struct ActualColumn {
    name: String,
    declared_type: String,
    not_null: bool,
    default_value: Option<String>,
    primary_key_position: i64,
}

pub(super) fn runtime_objects(
    connection: &Connection,
) -> Result<Vec<(String, String, String)>, AppError> {
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

pub(super) fn verify_columns(
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

pub(super) fn verify_indexes(
    connection: &Connection,
    table: &str,
    required: &[ExpectedIndex],
) -> Result<(), AppError> {
    let mut statement = connection
        .prepare("SELECT name, \"unique\", partial FROM pragma_index_list(?1)")
        .map_err(|_| AppError::Migration)?;
    let indexes = statement
        .query_map([table], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, i64>(1)? != 0,
                row.get::<_, i64>(2)? != 0,
            ))
        })
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    for (required_name, required_columns) in required {
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
