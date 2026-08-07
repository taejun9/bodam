use std::path::{Path, PathBuf};

#[cfg(not(windows))]
use std::fs;

#[cfg(windows)]
use super::directory_capability::DirectoryCapability;
#[cfg(not(windows))]
use super::file_ops::validate_user_directory;
use super::BackupError;

pub(super) fn canonicalize_selected_directory(path: &Path) -> Result<PathBuf, BackupError> {
    if !path.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    #[cfg(windows)]
    {
        let capability = DirectoryCapability::acquire(path, false)?;
        return Ok(capability.path().to_owned());
    }
    #[cfg(not(windows))]
    let canonical = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
    #[cfg(not(windows))]
    validate_user_directory(&canonical)?;
    #[cfg(not(windows))]
    Ok(canonical)
}

#[cfg(test)]
pub(super) fn validate_directory_identity(path: &Path) -> Result<(), BackupError> {
    if !path.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    #[cfg(windows)]
    {
        let capability = DirectoryCapability::acquire(path, false)?;
        return capability.ensure_path_identity();
    }
    #[cfg(not(windows))]
    let current = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
    #[cfg(not(windows))]
    if current != path {
        return Err(BackupError::path_unavailable());
    }
    #[cfg(not(windows))]
    validate_user_directory(path)
}

#[cfg(test)]
#[path = "directory_identity_tests.rs"]
mod tests;
