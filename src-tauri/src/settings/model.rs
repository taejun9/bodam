use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::error::AppError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct StoredAppSettings {
    pub theme: String,
    pub recent_consultation_days: i64,
    pub unconsulted_days: i64,
    pub dashboard_item_limit: i64,
    pub custom_backup_directory: Option<PathBuf>,
}

impl StoredAppSettings {
    pub(crate) fn to_view(&self) -> Result<AppSettingsView, AppError> {
        let backup_directory = match &self.custom_backup_directory {
            Some(path) => BackupDirectoryView {
                kind: BackupDirectoryKind::Custom,
                basename: Some(safe_directory_basename(path).ok_or(AppError::Database)?),
            },
            None => BackupDirectoryView {
                kind: BackupDirectoryKind::Default,
                basename: None,
            },
        };
        Ok(AppSettingsView {
            theme: self.theme.clone(),
            recent_consultation_days: self.recent_consultation_days,
            unconsulted_days: self.unconsulted_days,
            dashboard_item_limit: self.dashboard_item_limit,
            backup_directory,
        })
    }
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSettingsView {
    pub theme: String,
    pub recent_consultation_days: i64,
    pub unconsulted_days: i64,
    pub dashboard_item_limit: i64,
    pub backup_directory: BackupDirectoryView,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupDirectoryView {
    pub kind: BackupDirectoryKind,
    pub basename: Option<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum BackupDirectoryKind {
    Default,
    Custom,
}

#[derive(Debug, Clone, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateAppSettingsInput {
    pub theme: String,
    pub recent_consultation_days: i64,
    pub unconsulted_days: i64,
    pub dashboard_item_limit: i64,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct AppSettingsWrite {
    pub theme: String,
    pub recent_consultation_days: i64,
    pub unconsulted_days: i64,
    pub dashboard_item_limit: i64,
}

pub(crate) fn safe_directory_basename(path: &Path) -> Option<String> {
    if !path.is_absolute() {
        return None;
    }
    let basename = path
        .file_name()
        .and_then(|name| name.to_str())
        .filter(|name| {
            !name.is_empty()
                && *name != "."
                && *name != ".."
                && name.encode_utf16().count() <= 255
                && !name.contains('/')
                && !name.contains('\\')
                && !name.chars().any(char::is_control)
        })?;
    Some(basename.to_owned())
}
