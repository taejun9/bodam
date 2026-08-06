use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex, MutexGuard};

use crate::error::AppError;
use crate::settings::SettingsRepository;

use super::{BackupError, BackupManager, BackupResult, StartupRestoreStatus};

#[path = "runtime_contract.rs"]
mod contract;
#[path = "runtime_directory.rs"]
mod directory;
#[path = "runtime_lifecycle.rs"]
mod lifecycle;
#[path = "runtime_status.rs"]
mod status;

use contract::{validate_token, RETENTION_WARNING};
pub(crate) use contract::{
    BackupResultView, BackupStatusView, RestorePreparedView, RestorePreviewView,
};
use directory::{initial_location, ActiveLocation, BackupSettingsStore};
use lifecycle::LifecycleState;
use status::{OsStartupStatusAcknowledger, PendingStartupStatus, StartupStatusAcknowledger};

#[derive(Clone)]
pub(crate) struct BackupRuntime {
    inner: Arc<RuntimeInner>,
}

struct RuntimeInner {
    manager: BackupManager,
    settings: Arc<dyn BackupSettingsStore>,
    default_directory: PathBuf,
    operation: Mutex<()>,
    state: Mutex<RuntimeState>,
}

struct RuntimeState {
    location: ActiveLocation,
    directory_inconsistent: bool,
    last_failure: Option<String>,
    startup: PendingStartupStatus,
    lifecycle: LifecycleState,
}

impl BackupRuntime {
    pub(crate) fn open(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        app_version: String,
        startup: Option<StartupRestoreStatus>,
    ) -> Result<Self, AppError> {
        let settings = Arc::new(SettingsRepository::open(&database_path)?);
        Self::with_settings(database_path, app_data_dir, app_version, startup, settings)
    }

    fn with_settings(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        app_version: String,
        startup: Option<StartupRestoreStatus>,
        settings: Arc<dyn BackupSettingsStore>,
    ) -> Result<Self, AppError> {
        Self::build(
            database_path,
            app_data_dir,
            app_version,
            startup,
            settings,
            Arc::new(OsStartupStatusAcknowledger),
        )
    }

    fn build(
        database_path: PathBuf,
        app_data_dir: PathBuf,
        app_version: String,
        startup: Option<StartupRestoreStatus>,
        settings: Arc<dyn BackupSettingsStore>,
        acknowledger: Arc<dyn StartupStatusAcknowledger>,
    ) -> Result<Self, AppError> {
        let default_directory = app_data_dir.join("backups");
        let location = initial_location(settings.as_ref(), &default_directory)?;
        let startup = PendingStartupStatus::new(app_data_dir.clone(), startup, acknowledger);
        let manager = BackupManager::new(
            database_path,
            app_data_dir,
            location.directory.clone(),
            app_version,
        );
        Ok(Self {
            inner: Arc::new(RuntimeInner {
                manager,
                settings,
                default_directory,
                operation: Mutex::new(()),
                state: Mutex::new(RuntimeState {
                    location,
                    directory_inconsistent: false,
                    last_failure: None,
                    startup,
                    lifecycle: LifecycleState::default(),
                }),
            }),
        })
    }

    pub(crate) fn create_manual_backup(&self) -> Result<BackupResultView, BackupError> {
        let _operation = self.operation()?;
        let result = self.run_backup(|manager| manager.create_manual())?;
        BackupResultView::try_from(result)
    }

    pub(crate) fn preview_restore(&self, source: &Path) -> Result<RestorePreviewView, BackupError> {
        let _operation = self.operation()?;
        self.state()?.lifecycle.allow_preview_change()?;
        let preview = self.inner.manager.preview_restore(source)?;
        let token = preview.token.clone();
        let view = match RestorePreviewView::try_from(preview) {
            Ok(view) => view,
            Err(error) => {
                let _ = self.inner.manager.discard_restore_preview(&token);
                return Err(error);
            }
        };
        self.state()?.lifecycle.remember_preview(token);
        Ok(view)
    }

    pub(crate) fn discard_restore_preview(&self, token: &str) -> Result<(), BackupError> {
        validate_token(token)?;
        let _operation = self.operation()?;
        self.state()?.lifecycle.require_preview(token)?;
        self.inner.manager.discard_restore_preview(token)?;
        self.state()?.lifecycle.discard_preview();
        Ok(())
    }

    pub(crate) fn prepare_restore(&self, token: &str) -> Result<RestorePreparedView, BackupError> {
        validate_token(token)?;
        let _operation = self.operation()?;
        self.ensure_directory_consistent()?;
        self.state()?.lifecycle.require_preview(token)?;
        let pending = self.inner.manager.confirm_restore(token)?;
        let view = RestorePreparedView::try_from(pending)?;
        self.state()?.lifecycle.mark_restore_pending();
        Ok(view)
    }

    pub(crate) fn authorize_restore_restart(&self) -> Result<(), BackupError> {
        self.state()?.lifecycle.authorize_restore_restart()
    }

    pub(crate) fn begin_exit_backup(&self) -> Result<bool, BackupError> {
        Ok(self.state()?.lifecycle.begin_initial_exit_backup())
    }

    pub(crate) fn exit_failure_pending(&self) -> bool {
        self.state()
            .is_ok_and(|state| state.lifecycle.exit_failure_pending())
    }

    pub(crate) fn complete_exit_backup(&self) -> Result<(), BackupError> {
        self.run_exit_backup(false)
    }

    pub(crate) fn retry_exit_backup(&self) -> Result<(), BackupError> {
        self.state()?.lifecycle.begin_exit_retry()?;
        self.run_exit_backup(true)
    }

    pub(crate) fn allow_exit_without_backup(&self) -> Result<(), BackupError> {
        self.state()?.lifecycle.allow_failed_exit_once()
    }

    pub(crate) fn take_exit_bypass(&self) -> bool {
        self.state()
            .is_ok_and(|mut state| state.lifecycle.take_exit_bypass())
    }

    fn run_backup(
        &self,
        operation: impl FnOnce(&BackupManager) -> Result<BackupResult, BackupError>,
    ) -> Result<BackupResult, BackupError> {
        self.ensure_directory_consistent()?;
        match operation(&self.inner.manager) {
            Ok(result) => {
                self.state()?.last_failure =
                    (result.retention_warning_count > 0).then(|| RETENTION_WARNING.to_owned());
                Ok(result)
            }
            Err(error) => {
                self.state()?.last_failure = Some(error.message.to_owned());
                Err(error)
            }
        }
    }

    fn run_exit_backup(&self, retry: bool) -> Result<(), BackupError> {
        let operation = match self.operation() {
            Ok(operation) => operation,
            Err(error) => return self.finish_exit_failure(error),
        };
        let result = self.run_backup(|manager| manager.create_exit_if_changed());
        drop(operation);
        match result {
            Ok(_) => {
                self.state()?.lifecycle.finish_exit_success();
                Ok(())
            }
            Err(error) => {
                if retry {
                    self.state()?.lifecycle.mark_exit_failure();
                    Err(error)
                } else {
                    self.finish_exit_failure(error)
                }
            }
        }
    }

    fn finish_exit_failure<T>(&self, error: BackupError) -> Result<T, BackupError> {
        let mut state = self.state()?;
        state.last_failure = Some(error.message.to_owned());
        state.lifecycle.mark_exit_failure();
        Err(error)
    }

    fn operation(&self) -> Result<MutexGuard<'_, ()>, BackupError> {
        self.inner
            .operation
            .try_lock()
            .map_err(|_| BackupError::busy())
    }

    fn state(&self) -> Result<MutexGuard<'_, RuntimeState>, BackupError> {
        self.inner.state.lock().map_err(|_| BackupError::busy())
    }

    fn ensure_directory_consistent(&self) -> Result<(), BackupError> {
        if self.state()?.directory_inconsistent {
            return Err(directory_inconsistent());
        }
        Ok(())
    }
}

fn directory_inconsistent() -> BackupError {
    BackupError::new(
        "BACKUP_DIRECTORY_STATE_INCONSISTENT",
        "백업 위치 상태를 다시 확인해야 합니다.",
    )
}

#[cfg(test)]
#[path = "runtime_discard_tests.rs"]
mod discard_tests;
#[cfg(test)]
#[path = "runtime_tests.rs"]
mod tests;
