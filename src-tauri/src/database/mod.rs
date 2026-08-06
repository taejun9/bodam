mod migrations;
mod schema;

#[cfg(test)]
mod coverage_tests;
#[cfg(test)]
mod family_tests;
#[cfg(test)]
mod insurance_tests;
#[cfg(test)]
mod tests;

use std::path::Path;
use std::time::Duration;

use rusqlite::Connection;

use crate::error::AppError;

pub(crate) fn open(path: &Path) -> Result<Connection, AppError> {
    let mut connection = Connection::open(path).map_err(|_| AppError::Database)?;
    configure(&connection)?;
    connection
        .pragma_update(None, "journal_mode", "WAL")
        .map_err(|_| AppError::Database)?;
    migrations::run(&mut connection)?;
    Ok(connection)
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
