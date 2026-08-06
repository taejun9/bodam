use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::NaiveDateTime;
use uuid::Uuid;

pub(crate) fn validate_app_data_directory(database_value: Option<OsString>) -> io::Result<PathBuf> {
    let database = crate::e2e_paths::validate_database_path(database_value)?;
    database
        .parent()
        .map(Path::to_owned)
        .ok_or_else(invalid_path)
}

pub(crate) fn validate_backup_directory(
    directory_value: Option<OsString>,
    database_value: Option<OsString>,
) -> io::Result<Option<PathBuf>> {
    let Some(value) = directory_value else {
        return Ok(None);
    };
    let runtime = validate_app_data_directory(database_value)?;
    let directory = PathBuf::from(value);
    let basename = synthetic_basename(&directory)?;
    if !directory.is_absolute() {
        return Err(invalid_path());
    }
    let metadata = fs::symlink_metadata(&directory).map_err(|_| invalid_path())?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(invalid_path());
    }
    let resolved = fs::canonicalize(&directory).map_err(|_| invalid_path())?;
    if resolved.parent() != Some(runtime.as_path()) || resolved.file_name() != Some(basename) {
        return Err(invalid_path());
    }
    Ok(Some(resolved))
}

pub(crate) fn validate_restore_file(
    restore_value: Option<OsString>,
    backup_directory_value: Option<OsString>,
    database_value: Option<OsString>,
) -> io::Result<Option<PathBuf>> {
    let Some(value) = restore_value else {
        return Ok(None);
    };
    let backup_directory = validate_backup_directory(backup_directory_value, database_value)?
        .ok_or_else(invalid_path)?;
    let restore = PathBuf::from(value);
    let basename = restore
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(invalid_path)?;
    if !restore.is_absolute() || !is_artifact_basename(basename) {
        return Err(invalid_path());
    }
    let metadata = fs::symlink_metadata(&restore).map_err(|_| invalid_path())?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(invalid_path());
    }
    let resolved = fs::canonicalize(&restore).map_err(|_| invalid_path())?;
    if resolved.parent() != Some(backup_directory.as_path()) {
        return Err(invalid_path());
    }
    Ok(Some(resolved))
}

fn is_artifact_basename(value: &str) -> bool {
    let Some(stem) = value
        .strip_prefix("BODAM-")
        .and_then(|value| value.strip_suffix(".bodam-backup"))
    else {
        return false;
    };
    let Some(rest) = ["daily-", "exit-", "manual-", "pre-restore-"]
        .iter()
        .find_map(|reason| stem.strip_prefix(reason))
    else {
        return false;
    };
    if rest.len() != 56 || rest.as_bytes().get(19) != Some(&b'-') {
        return false;
    }
    let timestamp = &rest[..19];
    let token = &rest[20..];
    let valid_timestamp = NaiveDateTime::parse_from_str(timestamp, "%Y%m%dT%H%M%S%3fZ").is_ok();
    let valid_token = Uuid::parse_str(token).is_ok_and(|parsed| {
        parsed.get_version_num() == 4 && parsed.hyphenated().to_string() == token
    });
    valid_timestamp && valid_token
}

fn synthetic_basename(path: &Path) -> io::Result<&std::ffi::OsStr> {
    let basename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(invalid_path)?;
    let valid = basename.starts_with("synthetic-")
        && basename.len() <= 255
        && basename
            .bytes()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(byte, b'.' | b'_' | b'-'));
    if !valid {
        return Err(invalid_path());
    }
    path.file_name().ok_or_else(invalid_path)
}

fn invalid_path() -> io::Error {
    io::Error::other("BODAM E2E backup path is invalid")
}

#[cfg(test)]
#[path = "e2e_backup_paths_tests.rs"]
mod tests;
