mod migrations;
mod schema;

#[cfg(test)]
mod consultation_tests;
#[cfg(test)]
mod coverage_benchmark_tests;
#[cfg(test)]
mod coverage_tests;
#[cfg(test)]
mod data_exchange_tests;
#[cfg(test)]
mod family_tests;
#[cfg(test)]
mod insurance_tests;
#[cfg(test)]
mod schedule_tests;
#[cfg(test)]
mod settings_tests;
#[cfg(test)]
mod tests;

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;

use crate::error::AppError;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct RegisteredSchemaVersion {
    pub migration_count: u32,
    pub last_migration_name: String,
}

pub(crate) fn open(path: &Path) -> Result<Connection, AppError> {
    let mut connection = Connection::open(path).map_err(|_| AppError::Database)?;
    configure(&connection)?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|_| AppError::Database)?;
    migrations::run(&mut connection)?;
    Ok(connection)
}

pub(crate) fn verify_registered_prefix(
    connection: &Connection,
) -> Result<RegisteredSchemaVersion, AppError> {
    let count = migrations::verify_registered_prefix(connection)?;
    let last_index = count.checked_sub(1).ok_or(AppError::MigrationDrift)?;
    let last_migration_name = migrations::registered_name(last_index)
        .ok_or(AppError::MigrationDrift)?
        .to_owned();
    Ok(RegisteredSchemaVersion {
        migration_count: u32::try_from(count).map_err(|_| AppError::MigrationDrift)?,
        last_migration_name,
    })
}

pub(crate) fn verify_current(connection: &Connection) -> Result<RegisteredSchemaVersion, AppError> {
    migrations::verify_current(connection)?;
    verify_registered_prefix(connection)
}

#[cfg(test)]
pub(crate) fn current_registered_version() -> RegisteredSchemaVersion {
    let count = migrations::registered_count();
    RegisteredSchemaVersion {
        migration_count: u32::try_from(count).expect("registered migration count fits in u32"),
        last_migration_name: migrations::registered_name(count - 1)
            .expect("at least one registered migration")
            .to_owned(),
    }
}

#[cfg(test)]
pub(crate) fn create_registered_prefix_for_test(
    path: &Path,
    migration_count: usize,
) -> Result<(), AppError> {
    let mut connection = Connection::open(path).map_err(|_| AppError::Database)?;
    configure(&connection)?;
    let migrations = migrations::MIGRATIONS
        .get(..migration_count)
        .ok_or(AppError::MigrationDrift)?;
    migrations::apply_for_test(&mut connection, migrations)
}

#[cfg(test)]
pub(crate) fn open_in_memory() -> Result<Connection, AppError> {
    let mut connection = Connection::open_in_memory().map_err(|_| AppError::Database)?;
    configure(&connection)?;
    migrations::run(&mut connection)?;
    Ok(connection)
}

fn configure(connection: &Connection) -> Result<(), AppError> {
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|_| AppError::Database)?;
    connection
        .pragma_update(None, "foreign_keys", true)
        .map_err(|_| AppError::Database)?;
    Ok(())
}
