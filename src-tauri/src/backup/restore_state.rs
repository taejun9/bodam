use std::fs::{self, File};
use std::io::Read;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};
use uuid::Uuid;

use super::error::BackupError;
use super::file_ops::{
    is_safe_basename, sync_parent, write_atomic, AtomicReplacer, OsAtomicReplacer,
};
use super::model::{is_canonical_utc_millis, StartupRestoreStatus};

const MARKER_VERSION: u32 = 1;
const MAX_STATE_BYTES: u64 = 16 * 1024;

#[derive(Debug, Deserialize, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(super) struct PendingMarker {
    marker_version: u32,
    pub staged_archive_basename: String,
    pub safety_database_basename: String,
    pub backup_basename: String,
    pub backup_database_sha256: String,
    pub safety_database_sha256: String,
}

impl PendingMarker {
    pub(super) fn new(
        staged_archive_basename: String,
        safety_database_basename: String,
        backup_basename: String,
        backup_database_sha256: String,
        safety_database_sha256: String,
    ) -> Self {
        Self {
            marker_version: MARKER_VERSION,
            staged_archive_basename,
            safety_database_basename,
            backup_basename,
            backup_database_sha256,
            safety_database_sha256,
        }
    }

    fn is_valid(&self) -> bool {
        self.marker_version == MARKER_VERSION
            && is_restore_preview_basename(&self.staged_archive_basename)
            && is_restore_safety_basename(&self.safety_database_basename)
            && has_extension(&self.backup_basename, "bodam-backup")
            && is_sha256(&self.backup_database_sha256)
            && is_sha256(&self.safety_database_sha256)
    }
}

pub(super) fn write_marker(
    app_data_dir: &Path,
    marker: &PendingMarker,
    replacer: &dyn AtomicReplacer,
) -> Result<(), BackupError> {
    if !marker.is_valid() {
        return Err(BackupError::restore_failed());
    }
    let bytes = serde_json::to_vec(marker).map_err(|_| BackupError::restore_failed())?;
    write_atomic(&pending_marker_path(app_data_dir), &bytes, replacer)
}

pub(super) fn read_marker(app_data_dir: &Path) -> Result<Option<PendingMarker>, BackupError> {
    if !validate_state_root(app_data_dir)? {
        return Ok(None);
    }
    let path = pending_marker_path(app_data_dir);
    match fs::symlink_metadata(&path) {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(BackupError::restore_failed()),
    }
    let marker: PendingMarker =
        serde_json::from_slice(&read_bounded(&path)?).map_err(|_| BackupError::restore_failed())?;
    if !marker.is_valid() {
        return Err(BackupError::restore_failed());
    }
    Ok(Some(marker))
}

pub(super) fn write_status(
    app_data_dir: &Path,
    status: &StartupRestoreStatus,
    replacer: &dyn AtomicReplacer,
) -> Result<(), BackupError> {
    if !is_valid_status(status) {
        return Err(BackupError::restore_failed());
    }
    let bytes = serde_json::to_vec(status).map_err(|_| BackupError::restore_failed())?;
    write_atomic(&status_path(app_data_dir), &bytes, replacer)
}

pub(crate) fn read_status(
    app_data_dir: &Path,
) -> Result<Option<StartupRestoreStatus>, BackupError> {
    if !validate_state_root(app_data_dir)? {
        return Ok(None);
    }
    let path = status_path(app_data_dir);
    match fs::symlink_metadata(&path) {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err(BackupError::restore_failed()),
    }
    let status: StartupRestoreStatus =
        serde_json::from_slice(&read_bounded(&path)?).map_err(|_| BackupError::restore_failed())?;
    if !is_valid_status(&status) {
        return Err(BackupError::restore_failed());
    }
    Ok(Some(status))
}

pub(crate) fn acknowledge_status(
    app_data_dir: &Path,
    expected: &StartupRestoreStatus,
) -> Result<(), BackupError> {
    acknowledge_status_with_ops(app_data_dir, expected, &OsStatusAcknowledgeOps)
}

fn acknowledge_status_with_ops(
    app_data_dir: &Path,
    expected: &StartupRestoreStatus,
    operations: &dyn StatusAcknowledgeOps,
) -> Result<(), BackupError> {
    if read_status(app_data_dir)?.as_ref() != Some(expected) {
        return Err(BackupError::restore_failed());
    }
    let path = status_path(app_data_dir);
    operations.remove_file(&path)?;
    let parent = path.parent().ok_or_else(BackupError::restore_failed)?;
    if operations.sync_parent(parent).is_err() {
        let _ = write_status(app_data_dir, expected, &OsAtomicReplacer);
        return Err(BackupError::restore_failed());
    }
    Ok(())
}

trait StatusAcknowledgeOps {
    fn remove_file(&self, path: &Path) -> Result<(), BackupError>;
    fn sync_parent(&self, path: &Path) -> Result<(), BackupError>;
}

struct OsStatusAcknowledgeOps;

impl StatusAcknowledgeOps for OsStatusAcknowledgeOps {
    fn remove_file(&self, path: &Path) -> Result<(), BackupError> {
        fs::remove_file(path).map_err(|_| BackupError::restore_failed())
    }

    fn sync_parent(&self, path: &Path) -> Result<(), BackupError> {
        sync_parent(path).map_err(|_| BackupError::restore_failed())
    }
}

pub(super) fn safe_child(parent: &Path, name: &str) -> Result<PathBuf, BackupError> {
    if !is_safe_basename(name) {
        return Err(BackupError::restore_failed());
    }
    Ok(parent.join(name))
}

pub(super) fn basename(path: &Path) -> Result<String, BackupError> {
    path.file_name()
        .and_then(|value| value.to_str())
        .filter(|value| is_safe_basename(value))
        .map(str::to_owned)
        .ok_or_else(BackupError::restore_failed)
}

pub(super) fn restore_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("restore")
}

pub(super) fn is_restore_preview_basename(value: &str) -> bool {
    is_generated_basename(value, "restore-preview-", ".bodam-backup")
}

pub(super) fn is_restore_safety_basename(value: &str) -> bool {
    is_generated_basename(value, "restore-safety-", ".sqlite3")
}

pub(super) fn pending_marker_path(app_data_dir: &Path) -> PathBuf {
    restore_root(app_data_dir).join("pending-restore.json")
}

fn status_path(app_data_dir: &Path) -> PathBuf {
    restore_root(app_data_dir).join("restore-status.json")
}

fn validate_state_root(app_data_dir: &Path) -> Result<bool, BackupError> {
    let root = restore_root(app_data_dir);
    let metadata = match fs::symlink_metadata(&root) {
        Ok(metadata) => metadata,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(false),
        Err(_) => return Err(BackupError::restore_failed()),
    };
    if !root.is_absolute() || !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::restore_failed());
    }
    Ok(true)
}

fn read_bounded(path: &Path) -> Result<Vec<u8>, BackupError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::restore_failed())?;
    if !metadata.file_type().is_file()
        || metadata.file_type().is_symlink()
        || metadata.len() > MAX_STATE_BYTES
    {
        return Err(BackupError::restore_failed());
    }
    let mut bytes = Vec::new();
    File::open(path)
        .and_then(|mut file| file.read_to_end(&mut bytes))
        .map_err(|_| BackupError::restore_failed())?;
    Ok(bytes)
}

fn has_extension(value: &str, extension: &str) -> bool {
    is_safe_basename(value)
        && Path::new(value).extension().and_then(|part| part.to_str()) == Some(extension)
}

fn is_generated_basename(value: &str, prefix: &str, suffix: &str) -> bool {
    let Some(token) = value
        .strip_prefix(prefix)
        .and_then(|part| part.strip_suffix(suffix))
    else {
        return false;
    };
    Uuid::parse_str(token)
        .is_ok_and(|uuid| uuid.get_version_num() == 4 && uuid.hyphenated().to_string() == token)
}

fn is_sha256(value: &str) -> bool {
    value.len() == 64
        && value
            .bytes()
            .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
}

fn is_valid_status(status: &StartupRestoreStatus) -> bool {
    has_extension(&status.backup_basename, "bodam-backup")
        && is_canonical_utc_millis(&status.completed_at_utc)
}

#[cfg(test)]
#[path = "restore_state_tests.rs"]
mod tests;
