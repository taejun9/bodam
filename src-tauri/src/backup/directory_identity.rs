use std::fs;
use std::path::{Path, PathBuf};

use super::file_ops::validate_user_directory;
use super::BackupError;

pub(super) fn canonicalize_selected_directory(path: &Path) -> Result<PathBuf, BackupError> {
    if !path.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    let canonical = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
    validate_user_directory(&canonical)?;
    Ok(canonical)
}

#[cfg(test)]
pub(super) fn validate_directory_identity(path: &Path) -> Result<(), BackupError> {
    if !path.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    let current = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
    if current != path {
        return Err(BackupError::path_unavailable());
    }
    validate_user_directory(path)
}

#[cfg(test)]
#[path = "directory_identity_tests.rs"]
mod tests;
