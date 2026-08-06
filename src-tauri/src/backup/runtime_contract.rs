use std::path::Path;

use serde::Serialize;
use uuid::Uuid;

use super::super::model::{
    is_canonical_utc_millis, BackupReason, BackupResult, BackupStatus, RestoreOutcome,
    RestorePreview, StartupRestoreStatus,
};
use super::super::restore::PendingRestoreResult;
use super::super::BackupError;

pub(super) const RETENTION_WARNING: &str =
    "새 백업은 안전하지만 이전 자동 백업 일부를 정리하지 못했습니다.";

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "lowercase")]
pub(crate) enum BackupLocationKind {
    Default,
    Custom,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupStatusView {
    available: bool,
    location: BackupLocationView,
    last_successful_at: Option<String>,
    automatic_count: u32,
    max_automatic_count: u32,
    last_failure: Option<String>,
    restore_startup: Option<RestoreStartupView>,
    exit_failure_pending: bool,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct BackupLocationView {
    kind: BackupLocationKind,
    basename: Option<String>,
    available: bool,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct RestoreStartupView {
    outcome: RestoreOutcome,
    message: &'static str,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupResultView {
    basename: String,
    created_at: String,
    reason: BackupReason,
    retention_warning: bool,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RestorePreviewView {
    token: String,
    basename: String,
    created_at: String,
    app_version: String,
    schema_version: String,
    reason: BackupReason,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RestorePreparedView {
    restart_required: bool,
    safety_backup_basename: String,
}

impl BackupStatusView {
    pub(super) fn from_core(
        value: BackupStatus,
        kind: BackupLocationKind,
        basename: Option<String>,
        last_failure: Option<String>,
        startup: Option<&StartupRestoreStatus>,
        exit_failure_pending: bool,
    ) -> Result<Self, BackupError> {
        if kind == BackupLocationKind::Default && basename.is_some()
            || kind == BackupLocationKind::Custom
                && basename
                    .as_deref()
                    .is_none_or(|name| !is_safe_basename(name))
            || last_failure
                .as_deref()
                .is_some_and(|message| message.is_empty() || message.encode_utf16().count() > 300)
        {
            return Err(BackupError::archive_invalid());
        }
        validate_optional_timestamp(value.last_success_at_utc.as_deref())?;
        Ok(Self {
            available: true,
            location: BackupLocationView {
                kind,
                basename,
                available: value.directory_available,
            },
            last_successful_at: value.last_success_at_utc,
            automatic_count: value.automatic_count,
            max_automatic_count: 30,
            last_failure,
            restore_startup: startup.map(RestoreStartupView::from),
            exit_failure_pending,
        })
    }
}

impl TryFrom<BackupResult> for BackupResultView {
    type Error = BackupError;

    fn try_from(value: BackupResult) -> Result<Self, Self::Error> {
        let basename = value.basename.filter(|name| is_safe_basename(name));
        let manifest = value.manifest;
        if !value.created || basename.is_none() || manifest.is_none() {
            return Err(BackupError::archive_invalid());
        }
        let manifest = manifest.expect("manifest was checked");
        validate_timestamp(&manifest.created_at_utc)?;
        Ok(Self {
            basename: basename.expect("basename was checked"),
            created_at: manifest.created_at_utc,
            reason: manifest.reason,
            retention_warning: value.retention_warning_count > 0,
        })
    }
}

impl TryFrom<RestorePreview> for RestorePreviewView {
    type Error = BackupError;

    fn try_from(value: RestorePreview) -> Result<Self, Self::Error> {
        validate_token(&value.token)?;
        validate_timestamp(&value.created_at_utc)?;
        if !is_safe_basename(&value.basename)
            || !bounded(&value.app_version, 100)
            || !bounded(&value.schema_last_migration, 200)
        {
            return Err(BackupError::archive_invalid());
        }
        Ok(Self {
            token: value.token,
            basename: value.basename,
            created_at: value.created_at_utc,
            app_version: value.app_version,
            schema_version: value.schema_last_migration,
            reason: value.reason,
        })
    }
}

impl TryFrom<PendingRestoreResult> for RestorePreparedView {
    type Error = BackupError;

    fn try_from(value: PendingRestoreResult) -> Result<Self, Self::Error> {
        if !value.restart_required || !is_safe_basename(&value.pre_restore_basename) {
            return Err(BackupError::archive_invalid());
        }
        Ok(Self {
            restart_required: true,
            safety_backup_basename: value.pre_restore_basename,
        })
    }
}

impl From<&StartupRestoreStatus> for RestoreStartupView {
    fn from(value: &StartupRestoreStatus) -> Self {
        let message = match value.outcome {
            RestoreOutcome::Restored => "백업 복원이 완료되었습니다.",
            RestoreOutcome::RolledBack => "복원에 실패해 기존 데이터를 안전하게 유지했습니다.",
        };
        Self {
            outcome: value.outcome,
            message,
        }
    }
}

pub(super) fn safe_path_basename(path: &Path) -> Option<String> {
    if !path.is_absolute() {
        return None;
    }
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| is_safe_basename(value))
        .map(str::to_owned)
}

pub(super) fn effective_status_failure(
    status: &BackupStatus,
    remembered: Option<&str>,
) -> Option<String> {
    if status.automatic_count > 30 {
        return Some(RETENTION_WARNING.to_owned());
    }
    if !status.directory_available {
        return Some(BackupError::path_unavailable().message.to_owned());
    }
    remembered.map(str::to_owned)
}

pub(super) fn validate_token(value: &str) -> Result<(), BackupError> {
    if value.len() != 36 {
        return Err(BackupError::preview_unavailable());
    }
    let parsed = Uuid::parse_str(value).map_err(|_| BackupError::preview_unavailable())?;
    if parsed.get_version_num() != 4 || parsed.hyphenated().to_string() != value {
        return Err(BackupError::preview_unavailable());
    }
    Ok(())
}

fn validate_optional_timestamp(value: Option<&str>) -> Result<(), BackupError> {
    value.map_or(Ok(()), validate_timestamp)
}

fn validate_timestamp(value: &str) -> Result<(), BackupError> {
    if !is_canonical_utc_millis(value) {
        return Err(BackupError::archive_invalid());
    }
    Ok(())
}

fn bounded(value: &str, max: usize) -> bool {
    !value.is_empty() && value.encode_utf16().count() <= max
}

fn is_safe_basename(value: &str) -> bool {
    bounded(value, 255)
        && value != "."
        && value != ".."
        && !value.contains('/')
        && !value.contains('\\')
        && !value
            .chars()
            .any(|character| character.is_control() || character == '\u{7f}')
}

#[cfg(test)]
#[path = "runtime_contract_tests.rs"]
mod tests;
