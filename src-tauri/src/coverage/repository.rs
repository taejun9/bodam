mod categories;
mod coverages;
mod mapping;

use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::database;
use crate::error::AppError;

pub(crate) struct CoverageRepository {
    connection: Mutex<Connection>,
}

impl CoverageRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    pub(super) fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }
}
