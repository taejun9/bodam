use std::collections::BTreeSet;
use std::fmt::Write as _;

use rusqlite::{params, Connection, TransactionBehavior};
use sha2::{Digest, Sha256};

use crate::error::AppError;

use super::schema;

pub(crate) struct Migration {
    pub name: &'static str,
    pub checksum_sha256: &'static str,
    pub sql: &'static str,
}

pub(crate) const MIGRATIONS: &[Migration] = &[
    Migration {
        name: "20260806000000_init_customer",
        checksum_sha256: "4583d3d1e50303b9db6f31636fdf7f3a8b765f52c603ddfd087a84dcd11f4e11",
        sql: include_str!(
            "../../../database/prisma/migrations/20260806000000_init_customer/migration.sql"
        ),
    },
    Migration {
        name: "20260806010000_add_insurance_policy",
        checksum_sha256: "df3f753cb3b34dfb11363df16946683bc946f82a87fb4893087dbe3ce91dc733",
        sql: include_str!(
            "../../../database/prisma/migrations/20260806010000_add_insurance_policy/migration.sql"
        ),
    },
    Migration {
        name: "20260806020000_add_coverage",
        checksum_sha256: "9b105aafa8df7f5f4b7bc6b04504286305dc9e66f5cccb951fb989deab0e4ef7",
        sql: include_str!(
            "../../../database/prisma/migrations/20260806020000_add_coverage/migration.sql"
        ),
    },
];

const HISTORY_TABLE_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS "bodam_schema_migrations" (
    "migration_name" TEXT NOT NULL PRIMARY KEY,
    "checksum_sha256" TEXT NOT NULL,
    "applied_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
"#;

pub(crate) fn run(connection: &mut Connection) -> Result<(), AppError> {
    let applied_count = prepare_registered(connection, MIGRATIONS)?;
    schema::verify_registered_version(connection, applied_count)?;
    apply_missing(connection, MIGRATIONS, applied_count)?;
    verify_history_exact(connection, MIGRATIONS)?;
    schema::verify_registered_version(connection, MIGRATIONS.len())
}

#[cfg(test)]
fn apply_registered(connection: &mut Connection, migrations: &[Migration]) -> Result<(), AppError> {
    let applied_count = prepare_registered(connection, migrations)?;
    apply_missing(connection, migrations, applied_count)?;
    verify_history_exact(connection, migrations)
}

fn prepare_registered(
    connection: &Connection,
    migrations: &[Migration],
) -> Result<usize, AppError> {
    connection
        .execute_batch(HISTORY_TABLE_SQL)
        .map_err(|_| AppError::Migration)?;
    schema::verify_history_table(connection)?;
    verify_registry(migrations)?;
    let history = migration_history(connection)?;
    verify_history_prefix(&history, migrations)?;
    Ok(history.len())
}

fn verify_registry(migrations: &[Migration]) -> Result<(), AppError> {
    let mut names = BTreeSet::new();
    for migration in migrations {
        if !names.insert(migration.name) || checksum(migration.sql) != migration.checksum_sha256 {
            return Err(AppError::MigrationDrift);
        }
    }
    Ok(())
}

fn migration_history(connection: &Connection) -> Result<Vec<(String, String)>, AppError> {
    let mut statement = connection
        .prepare(
            "SELECT migration_name, checksum_sha256
             FROM bodam_schema_migrations ORDER BY rowid",
        )
        .map_err(|_| AppError::MigrationDrift)?;
    let history = statement
        .query_map([], |row| Ok((row.get(0)?, row.get(1)?)))
        .map_err(|_| AppError::MigrationDrift)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::MigrationDrift)?;
    Ok(history)
}

fn verify_history_prefix(
    history: &[(String, String)],
    migrations: &[Migration],
) -> Result<(), AppError> {
    if history.len() > migrations.len()
        || history.iter().zip(migrations).any(|(stored, migration)| {
            stored.0 != migration.name || stored.1 != migration.checksum_sha256
        })
    {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn verify_history_exact(connection: &Connection, migrations: &[Migration]) -> Result<(), AppError> {
    let history = migration_history(connection)?;
    verify_history_prefix(&history, migrations)?;
    if history.len() != migrations.len() {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn apply_missing(
    connection: &mut Connection,
    migrations: &[Migration],
    applied_count: usize,
) -> Result<(), AppError> {
    for migration in &migrations[applied_count..] {
        let transaction = connection
            .transaction_with_behavior(TransactionBehavior::Immediate)
            .map_err(|_| AppError::Migration)?;
        transaction
            .execute_batch(migration.sql)
            .map_err(|_| AppError::Migration)?;
        transaction
            .execute(
                "INSERT INTO bodam_schema_migrations (migration_name, checksum_sha256) VALUES (?1, ?2)",
                params![migration.name, migration.checksum_sha256],
            )
            .map_err(|_| AppError::Migration)?;
        transaction.commit().map_err(|_| AppError::Migration)?;
    }
    Ok(())
}

fn checksum(sql: &str) -> String {
    let digest = Sha256::digest(sql.as_bytes());
    let mut encoded = String::with_capacity(digest.len() * 2);
    for byte in digest {
        let _ = write!(encoded, "{byte:02x}");
    }
    encoded
}

#[cfg(test)]
pub(super) fn apply_for_test(
    connection: &mut Connection,
    migrations: &[Migration],
) -> Result<(), AppError> {
    apply_registered(connection, migrations)
}

#[cfg(test)]
pub(super) fn checksum_for_test(sql: &str) -> String {
    checksum(sql)
}
