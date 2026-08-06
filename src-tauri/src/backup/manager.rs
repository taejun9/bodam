use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};

use super::backup_destination::BackupDestination;
use super::clock::{BackupClock, SystemBackupClock};
use super::directory_capability::DirectoryCapability;
use super::error::BackupError;
use super::file_ops::{AtomicReplacer, OsAtomicReplacer};
use super::model::RestorePreview;
use super::restore::{prepare_restore_preview, PendingRestoreResult, PreparedRestore};
use super::restore_preview_discard::{
    discard_prepared, OsRestorePreviewRemover, RestorePreviewRemover,
};
use super::restore_stage::stage_pending_restore;
use super::retention::{OsRetentionRemover, RetentionRemover};
use super::temporary_cleanup::{prepare_workspace, OsTemporaryCleanupOps, TemporaryCleanupOps};
use super::temporary_cleanup_capability::sweep_backup_directory_in;

pub(crate) struct BackupManager {
    pub(super) database_path: PathBuf,
    pub(super) app_data_dir: PathBuf,
    backup_destination: Mutex<BackupDestination>,
    pub(super) app_version: String,
    pub(super) clock: Arc<dyn BackupClock>,
    pub(super) replacer: Arc<dyn AtomicReplacer>,
    pub(super) remover: Arc<dyn RetentionRemover>,
    pub(super) cleanup: Arc<dyn TemporaryCleanupOps>,
    pub(super) preview_remover: Arc<dyn RestorePreviewRemover>,
    pub(super) operation: Mutex<()>,
    prepared: Mutex<Option<PreparedRestore>>,
}

impl BackupManager {
    pub(crate) fn new(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        backup_directory: PathBuf,
        app_version: String,
    ) -> Self {
        Self::with_dependencies(
            database_path,
            app_data_dir,
            backup_directory,
            app_version,
            Arc::new(SystemBackupClock),
            Arc::new(OsAtomicReplacer),
            Arc::new(OsRetentionRemover),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(super) fn with_dependencies(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        backup_directory: PathBuf,
        app_version: String,
        clock: Arc<dyn BackupClock>,
        replacer: Arc<dyn AtomicReplacer>,
        remover: Arc<dyn RetentionRemover>,
    ) -> Self {
        Self::with_cleanup_dependencies(
            database_path,
            app_data_dir,
            backup_directory,
            app_version,
            clock,
            replacer,
            remover,
            Arc::new(OsTemporaryCleanupOps),
        )
    }

    #[allow(clippy::too_many_arguments)]
    pub(super) fn with_cleanup_dependencies(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        backup_directory: PathBuf,
        app_version: String,
        clock: Arc<dyn BackupClock>,
        replacer: Arc<dyn AtomicReplacer>,
        remover: Arc<dyn RetentionRemover>,
        cleanup: Arc<dyn TemporaryCleanupOps>,
    ) -> Self {
        Self {
            database_path,
            app_data_dir,
            backup_destination: Mutex::new(BackupDestination::new(backup_directory)),
            app_version,
            clock,
            replacer,
            remover,
            cleanup,
            preview_remover: Arc::new(OsRestorePreviewRemover),
            operation: Mutex::new(()),
            prepared: Mutex::new(None),
        }
    }

    pub(crate) fn set_backup_directory(&self, directory: PathBuf) -> Result<(), BackupError> {
        prepare_workspace(&self.app_data_dir, self.cleanup.as_ref())?;
        let mut destination = BackupDestination::prepared(directory, &self.default_directory())?;
        let capability = destination.capability(&self.default_directory())?;
        capability.ensure_path_identity()?;
        sweep_backup_directory_in(&capability, self.cleanup.as_ref())?;
        capability.ensure_path_identity()?;
        *self
            .backup_destination
            .lock()
            .map_err(|_| BackupError::busy())? = destination;
        Ok(())
    }

    pub(crate) fn preview_restore(&self, source: &Path) -> Result<RestorePreview, BackupError> {
        let _operation = self.operation.try_lock().map_err(|_| BackupError::busy())?;
        let mut slot = self.prepared.lock().map_err(|_| BackupError::busy())?;
        if slot.is_some() {
            return Err(BackupError::preview_unavailable());
        }
        let (prepared, preview) = prepare_restore_preview(source, &self.app_data_dir)?;
        *slot = Some(prepared);
        Ok(preview)
    }

    pub(crate) fn discard_restore_preview(&self, token: &str) -> Result<(), BackupError> {
        let _operation = self.operation.try_lock().map_err(|_| BackupError::busy())?;
        let mut slot = self.prepared.lock().map_err(|_| BackupError::busy())?;
        let prepared = slot
            .as_ref()
            .filter(|value| value.token == token)
            .ok_or_else(BackupError::preview_unavailable)?;
        discard_prepared(prepared, self.preview_remover.as_ref())?;
        slot.take();
        Ok(())
    }

    pub(crate) fn confirm_restore(&self, token: &str) -> Result<PendingRestoreResult, BackupError> {
        let _operation = self.operation.try_lock().map_err(|_| BackupError::busy())?;
        let slot = self.prepared.lock().map_err(|_| BackupError::busy())?;
        let prepared = slot
            .as_ref()
            .filter(|value| value.token == token)
            .ok_or_else(BackupError::preview_unavailable)?;
        let reading = self.clock.now();
        let local_date = reading.local_date.format("%Y-%m-%d").to_string();
        let backup_directory = self.prepare_backup_directory()?;
        let result = stage_pending_restore(
            prepared,
            &self.database_path,
            &self.app_data_dir,
            &backup_directory,
            &self.app_version,
            reading.utc,
            &local_date,
            self.replacer.as_ref(),
        )?;
        Ok(result)
    }

    pub(super) fn prepare_backup_directory(&self) -> Result<Arc<DirectoryCapability>, BackupError> {
        prepare_workspace(&self.app_data_dir, self.cleanup.as_ref())?;
        let capability = self
            .backup_destination
            .lock()
            .map_err(|_| BackupError::busy())?
            .capability(&self.default_directory())?;
        capability.ensure_path_identity()?;
        sweep_backup_directory_in(&capability, self.cleanup.as_ref())?;
        capability.ensure_path_identity()?;
        Ok(capability)
    }

    fn default_directory(&self) -> PathBuf {
        self.app_data_dir.join("backups")
    }
}
