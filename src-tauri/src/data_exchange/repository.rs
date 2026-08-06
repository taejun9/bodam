use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use rusqlite::Connection;

use crate::database;
use crate::error::AppError;

use super::commit::commit_import;
use super::commit_model::{ImportCommitRequest, ImportCommitResult};
use super::context::{load_context, ImportContextQuery, ImportContextSnapshot};
use super::export_model::ContractExportSnapshot;
use super::export_query::load_export_snapshot;

pub(crate) struct DataExchangeRepository {
    connection: Mutex<Connection>,
}

impl DataExchangeRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    #[cfg(test)]
    pub(crate) fn in_memory() -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open_in_memory()?),
        })
    }

    pub(crate) fn context(
        &self,
        query: ImportContextQuery,
    ) -> Result<ImportContextSnapshot, AppError> {
        let connection = self.lock()?;
        load_context(&connection, query)
    }

    pub(crate) fn commit(
        &self,
        request: ImportCommitRequest,
    ) -> Result<ImportCommitResult, AppError> {
        let mut connection = self.lock()?;
        commit_import(&mut connection, request)
    }

    pub(super) fn export_snapshot(&self) -> Result<ContractExportSnapshot, AppError> {
        let connection = self.lock()?;
        load_export_snapshot(&connection)
    }

    pub(super) fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }
}
