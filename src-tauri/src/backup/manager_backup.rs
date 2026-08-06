use std::sync::Arc;

use super::backup_write::{artifact_basename, create_backup, not_created};
use super::clock::ClockReading;
use super::directory_capability::DirectoryCapability;
use super::manager::BackupManager;
use super::model::{BackupReason, BackupResult, BackupStatus};
use super::retention::{scan_verified_backups_from, VerifiedBackupCatalog};
use super::temporary_cleanup::workspace_root;
use super::BackupError;

impl BackupManager {
    pub(crate) fn backup_status(&self) -> Result<BackupStatus, BackupError> {
        let directory = match self.prepare_backup_directory() {
            Ok(directory) => directory,
            Err(_) => return Ok(unavailable_status()),
        };
        let catalog = scan_verified_backups_from(
            directory,
            &workspace_root(&self.app_data_dir),
            self.cleanup.as_ref(),
        )?;
        Ok(catalog.summarize().into_status())
    }

    #[cfg(test)]
    pub(crate) fn create_daily_if_due(&self) -> Result<BackupResult, BackupError> {
        self.check_daily_and_status().0
    }

    pub(crate) fn check_daily_and_status(
        &self,
    ) -> (Result<BackupResult, BackupError>, BackupStatus) {
        let _operation = match self.operation.try_lock() {
            Ok(operation) => operation,
            Err(_) => return failed_daily(BackupError::busy()),
        };
        let reading = self.clock.now();
        let directory = match self.prepare_backup_directory() {
            Ok(directory) => directory,
            Err(error) => return failed_daily(error),
        };
        let mut catalog = match scan_verified_backups_from(
            directory.clone(),
            &workspace_root(&self.app_data_dir),
            self.cleanup.as_ref(),
        ) {
            Ok(catalog) => catalog,
            Err(error) => return failed_daily(error),
        };
        let local_date = reading.local_date.format("%Y-%m-%d").to_string();
        let result = if catalog.has_automatic_for_local_date(&local_date) {
            Ok(not_created())
        } else {
            self.create_managed(
                BackupReason::Daily,
                reading,
                directory,
                false,
                Some(&mut catalog),
            )
        };
        let status = catalog.summarize().into_status();
        (result, status)
    }

    pub(crate) fn create_exit_if_changed(&self) -> Result<BackupResult, BackupError> {
        let _operation = self.operation.try_lock().map_err(|_| BackupError::busy())?;
        let reading = self.clock.now();
        let directory = self.prepare_backup_directory()?;
        let mut catalog = scan_verified_backups_from(
            directory.clone(),
            &workspace_root(&self.app_data_dir),
            self.cleanup.as_ref(),
        )?;
        self.create_managed(
            BackupReason::Exit,
            reading,
            directory,
            true,
            Some(&mut catalog),
        )
    }

    pub(crate) fn create_manual(&self) -> Result<BackupResult, BackupError> {
        let _operation = self.operation.try_lock().map_err(|_| BackupError::busy())?;
        let reading = self.clock.now();
        let directory = self.prepare_backup_directory()?;
        self.create_managed(BackupReason::Manual, reading, directory, false, None)
    }

    fn create_managed(
        &self,
        reason: BackupReason,
        reading: ClockReading,
        directory: Arc<DirectoryCapability>,
        changed_only: bool,
        catalog: Option<&mut VerifiedBackupCatalog>,
    ) -> Result<BackupResult, BackupError> {
        let basename = artifact_basename(reason, reading.utc);
        create_backup(
            &self.database_path,
            &workspace_root(&self.app_data_dir),
            &directory,
            &basename,
            reason,
            reading,
            &self.app_version,
            changed_only,
            catalog,
            self.replacer.as_ref(),
            self.remover.as_ref(),
            self.cleanup.as_ref(),
        )
    }
}

fn failed_daily(error: BackupError) -> (Result<BackupResult, BackupError>, BackupStatus) {
    (Err(error), unavailable_status())
}

fn unavailable_status() -> BackupStatus {
    BackupStatus {
        directory_available: false,
        automatic_count: 0,
        last_success_at_utc: None,
    }
}
