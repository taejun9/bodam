use std::path::{Path, PathBuf};

use crate::error::AppError;
use crate::settings::SettingsRepository;

use super::contract::{safe_path_basename, BackupLocationKind, BackupStatusView};
use super::{BackupError, BackupRuntime};
use crate::backup::directory_identity::canonicalize_selected_directory;

#[derive(Clone)]
pub(super) struct ActiveLocation {
    pub(super) kind: BackupLocationKind,
    pub(super) directory: PathBuf,
}

pub(super) trait BackupSettingsStore: Send + Sync {
    fn custom_backup_directory(&self) -> Result<Option<PathBuf>, AppError>;
    fn set_custom_backup_directory(&self, directory: &Path) -> Result<(), AppError>;
    fn clear_custom_backup_directory(&self) -> Result<(), AppError>;
}

impl BackupSettingsStore for SettingsRepository {
    fn custom_backup_directory(&self) -> Result<Option<PathBuf>, AppError> {
        SettingsRepository::custom_backup_directory(self)
    }

    fn set_custom_backup_directory(&self, directory: &Path) -> Result<(), AppError> {
        SettingsRepository::set_custom_backup_directory(self, directory).map(drop)
    }

    fn clear_custom_backup_directory(&self) -> Result<(), AppError> {
        SettingsRepository::clear_custom_backup_directory(self).map(drop)
    }
}

pub(super) fn initial_location(
    settings: &dyn BackupSettingsStore,
    default_directory: &Path,
) -> Result<ActiveLocation, AppError> {
    match settings.custom_backup_directory()? {
        Some(directory) if safe_path_basename(&directory).is_some() => Ok(ActiveLocation {
            kind: BackupLocationKind::Custom,
            directory,
        }),
        Some(_) => Err(AppError::Database),
        None => Ok(ActiveLocation {
            kind: BackupLocationKind::Default,
            directory: default_directory.to_owned(),
        }),
    }
}

impl BackupRuntime {
    pub(crate) fn select_directory(
        &self,
        directory: PathBuf,
    ) -> Result<BackupStatusView, BackupError> {
        let directory = canonicalize_selected_directory(&directory)?;
        if safe_path_basename(&directory).is_none() {
            return Err(BackupError::path_unavailable());
        }
        self.change_directory(
            ActiveLocation {
                kind: BackupLocationKind::Custom,
                directory,
            },
            true,
        )
    }

    pub(crate) fn use_default_directory(&self) -> Result<BackupStatusView, BackupError> {
        self.change_directory(
            ActiveLocation {
                kind: BackupLocationKind::Default,
                directory: self.inner.default_directory.clone(),
            },
            false,
        )
    }

    fn change_directory(
        &self,
        target: ActiveLocation,
        custom: bool,
    ) -> Result<BackupStatusView, BackupError> {
        let _operation = self.operation()?;
        let previous = self.state()?.location.clone();
        self.inner
            .manager
            .set_backup_directory(target.directory.clone())?;
        let persisted = if custom {
            self.inner
                .settings
                .set_custom_backup_directory(&target.directory)
        } else {
            self.inner.settings.clear_custom_backup_directory()
        };
        if persisted.is_err() {
            let rolled_back = self
                .inner
                .manager
                .set_backup_directory(previous.directory)
                .is_ok();
            let mut state = self.state()?;
            state.directory_inconsistent = !rolled_back;
            state.last_failure = Some(directory_settings_unavailable().message.to_owned());
            return Err(directory_settings_unavailable());
        }
        let mut state = self.state()?;
        state.location = target;
        state.directory_inconsistent = false;
        state.last_failure = None;
        drop(state);
        self.status_locked()
    }
}

fn directory_settings_unavailable() -> BackupError {
    BackupError::new(
        "BACKUP_DIRECTORY_SETTINGS_UNAVAILABLE",
        "백업 위치 설정을 안전하게 저장하지 못했습니다.",
    )
}
