use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::contract::{
    effective_status_failure, safe_path_basename, BackupLocationKind, BackupStatusView,
    RETENTION_WARNING,
};
use super::BackupRuntime;
use crate::backup::{acknowledge_startup_status, BackupError, BackupStatus, StartupRestoreStatus};

pub(super) trait StartupStatusAcknowledger: Send + Sync {
    fn acknowledge(
        &self,
        app_data_dir: &Path,
        expected: &StartupRestoreStatus,
    ) -> Result<(), BackupError>;
}

pub(super) struct OsStartupStatusAcknowledger;

impl StartupStatusAcknowledger for OsStartupStatusAcknowledger {
    fn acknowledge(
        &self,
        app_data_dir: &Path,
        expected: &StartupRestoreStatus,
    ) -> Result<(), BackupError> {
        acknowledge_startup_status(app_data_dir, expected)
    }
}

pub(super) struct PendingStartupStatus {
    app_data_dir: PathBuf,
    value: Option<StartupRestoreStatus>,
    acknowledger: Arc<dyn StartupStatusAcknowledger>,
}

impl PendingStartupStatus {
    pub(super) fn new(
        app_data_dir: PathBuf,
        value: Option<StartupRestoreStatus>,
        acknowledger: Arc<dyn StartupStatusAcknowledger>,
    ) -> Self {
        Self {
            app_data_dir,
            value,
            acknowledger,
        }
    }

    fn as_ref(&self) -> Option<&StartupRestoreStatus> {
        self.value.as_ref()
    }

    fn acknowledge(&mut self) -> Result<(), BackupError> {
        let Some(value) = self.value.as_ref() else {
            return Ok(());
        };
        self.acknowledger.acknowledge(&self.app_data_dir, value)?;
        self.value = None;
        Ok(())
    }
}

impl BackupRuntime {
    pub(crate) fn load_status(&self) -> Result<BackupStatusView, BackupError> {
        let _operation = self.operation()?;
        self.status_locked_with_startup()
    }

    pub(crate) fn acknowledge_restore_startup(&self) -> Result<(), BackupError> {
        let _operation = self.operation()?;
        self.state()?.startup.acknowledge()
    }

    pub(crate) fn check_daily_backup(&self) -> Result<BackupStatusView, BackupError> {
        let _operation = self.operation()?;
        if let Err(error) = self.ensure_directory_consistent() {
            self.state()?.last_failure = Some(error.message.to_owned());
            return self.status_locked();
        }
        let (result, status) = self.inner.manager.check_daily_and_status();
        match result {
            Ok(result) => {
                self.state()?.last_failure =
                    (result.retention_warning_count > 0).then(|| RETENTION_WARNING.to_owned());
                self.status_from_core(status, false)
            }
            Err(error) => {
                self.state()?.last_failure = Some(error.message.to_owned());
                self.status_from_core(status, false)
            }
        }
    }

    pub(super) fn status_locked(&self) -> Result<BackupStatusView, BackupError> {
        let status = self.core_status()?;
        self.status_from_core(status, false)
    }

    fn status_locked_with_startup(&self) -> Result<BackupStatusView, BackupError> {
        let status = self.core_status()?;
        self.status_from_core(status, true)
    }

    fn core_status(&self) -> Result<BackupStatus, BackupError> {
        if self.state()?.directory_inconsistent {
            Ok(BackupStatus {
                directory_available: false,
                automatic_count: 0,
                last_success_at_utc: None,
            })
        } else {
            self.inner.manager.backup_status()
        }
    }

    fn status_from_core(
        &self,
        status: BackupStatus,
        include_startup: bool,
    ) -> Result<BackupStatusView, BackupError> {
        let state = self.state()?;
        let basename = match state.location.kind {
            BackupLocationKind::Default => None,
            BackupLocationKind::Custom => safe_path_basename(&state.location.directory),
        };
        let failure = effective_status_failure(&status, state.last_failure.as_deref());
        let startup = include_startup.then(|| state.startup.as_ref()).flatten();
        BackupStatusView::from_core(
            status,
            state.location.kind,
            basename,
            failure,
            startup,
            state.lifecycle.exit_failure_pending(),
        )
    }
}

#[cfg(test)]
#[path = "runtime_status_tests.rs"]
mod tests;
