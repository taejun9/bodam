use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::error::BackupError;
use super::file_ops::sync_parent;
use super::restore_state::{is_restore_preview_basename, is_restore_safety_basename, restore_root};

const RESTORE_ROOT_PATTERNS: &[(&str, &str)] = &[
    ("restore-preview-", ".bodam-backup"),
    ("restore-safety-", ".sqlite3"),
    ("restore-working-", ".sqlite3"),
];
const DATABASE_PARENT_PATTERNS: &[(&str, &str)] = &[
    (".bodam-restore-", ".sqlite3"),
    (".bodam-rollback-", ".sqlite3"),
];
const SQLITE_SIDECARS: &[&str] = &["-wal", "-shm", "-journal"];

pub(super) trait RestoreRemover: Send + Sync {
    fn remove_file(&self, path: &Path) -> io::Result<()>;

    fn sync_parent(&self, parent: &Path) -> io::Result<()> {
        sync_parent(parent).map_err(|_| io::Error::other("restore directory sync failed"))
    }
}

pub(super) struct OsRestoreRemover;

impl RestoreRemover for OsRestoreRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }
}

pub(super) fn cleanup_preview(
    app_data_dir: &Path,
    path: &Path,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    validate_generated_child(app_data_dir, path, is_restore_preview_basename)?;
    cleanup_paths(&[path.to_owned()], remover)
}

pub(super) fn cleanup_safety(
    app_data_dir: &Path,
    path: &Path,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    validate_generated_child(app_data_dir, path, is_restore_safety_basename)?;
    cleanup_paths(&sqlite_paths(path), remover)
}

pub(super) fn cleanup_completed_restore(
    marker: &Path,
    staged: &Path,
    safety: &Path,
    working: &Path,
    replacement: &Path,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    remove_owned_file(marker, true, remover)?;
    remove_owned_file(staged, false, remover)?;
    for operand in [safety, working, replacement] {
        remove_owned_sqlite(operand, remover)?;
    }
    Ok(())
}

pub(super) fn sweep_orphaned_restore_files(
    app_data_dir: &Path,
    database_path: &Path,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    sweep_orphaned_restore_files_except(app_data_dir, database_path, &[], remover)
}

pub(super) fn sweep_orphaned_restore_files_except(
    app_data_dir: &Path,
    database_path: &Path,
    preserved: &[&Path],
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    let mut restore_preserved = Vec::new();
    for path in preserved {
        restore_preserved.push((*path).to_owned());
        if path.extension().and_then(|value| value.to_str()) == Some("sqlite3") {
            restore_preserved.extend(sqlite_paths(path).into_iter().skip(1));
        }
    }
    sweep_directory(
        &restore_root(app_data_dir),
        RESTORE_ROOT_PATTERNS,
        false,
        &restore_preserved,
        remover,
    )?;
    let database_parent = database_path
        .parent()
        .ok_or_else(BackupError::restore_failed)?;
    sweep_directory(
        database_parent,
        DATABASE_PARENT_PATTERNS,
        true,
        &[],
        remover,
    )
}

fn sweep_directory(
    root: &Path,
    patterns: &[(&str, &str)],
    required: bool,
    preserved: &[PathBuf],
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if !required && error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err(BackupError::restore_failed()),
    };
    if !root.is_absolute() || !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::restore_failed());
    }
    let entries = fs::read_dir(root).map_err(|_| BackupError::restore_failed())?;
    let mut matches = Vec::new();
    for entry in entries {
        let entry = entry.map_err(|_| BackupError::restore_failed())?;
        let name = entry.file_name();
        let Some(name) = name.to_str() else {
            continue;
        };
        if patterns
            .iter()
            .any(|pattern| matches_pattern(name, *pattern))
            && !preserved.contains(&entry.path())
        {
            preflight_owned_file(&entry.path(), true)?;
            matches.push(entry.path());
        }
    }
    remove_preflighted(&matches, root, remover)
}

fn remove_owned_file(
    path: &Path,
    required: bool,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    if !preflight_owned_file(path, required)? {
        return Ok(());
    }
    remover
        .remove_file(path)
        .map_err(|_| BackupError::restore_failed())?;
    remover
        .sync_parent(path.parent().ok_or_else(BackupError::restore_failed)?)
        .map_err(|_| BackupError::restore_failed())
}

fn remove_owned_sqlite(path: &Path, remover: &dyn RestoreRemover) -> Result<(), BackupError> {
    cleanup_paths(&sqlite_paths(path), remover)
}

fn validate_generated_child(
    app_data_dir: &Path,
    path: &Path,
    matches_name: fn(&str) -> bool,
) -> Result<(), BackupError> {
    let root = restore_root(app_data_dir);
    let valid = path.is_absolute()
        && path.parent() == Some(root.as_path())
        && path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(matches_name);
    if valid {
        Ok(())
    } else {
        Err(BackupError::restore_failed())
    }
}

fn cleanup_paths(paths: &[PathBuf], remover: &dyn RestoreRemover) -> Result<(), BackupError> {
    let parent = paths
        .first()
        .and_then(|path| path.parent())
        .ok_or_else(BackupError::restore_failed)?;
    let mut existing = Vec::new();
    for path in paths {
        if path.parent() != Some(parent) {
            return Err(BackupError::restore_failed());
        }
        if preflight_owned_file(path, false)? {
            existing.push(path.clone());
        }
    }
    remove_preflighted(&existing, parent, remover)
}

fn preflight_owned_file(path: &Path, required: bool) -> Result<bool, BackupError> {
    let metadata = match fs::symlink_metadata(path) {
        Ok(metadata) => metadata,
        Err(error) if !required && error.kind() == io::ErrorKind::NotFound => return Ok(false),
        Err(_) => return Err(BackupError::restore_failed()),
    };
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(BackupError::restore_failed());
    }
    Ok(true)
}

fn remove_preflighted(
    paths: &[PathBuf],
    parent: &Path,
    remover: &dyn RestoreRemover,
) -> Result<(), BackupError> {
    let mut failed = false;
    for path in paths {
        if remover.remove_file(path).is_err() {
            failed = true;
        }
    }
    if remover.sync_parent(parent).is_err() {
        failed = true;
    }
    if failed {
        Err(BackupError::restore_failed())
    } else {
        Ok(())
    }
}

fn matches_pattern(name: &str, (prefix, suffix): (&str, &str)) -> bool {
    is_generated_name(name, prefix, suffix)
        || (suffix == ".sqlite3"
            && SQLITE_SIDECARS
                .iter()
                .any(|sidecar| is_generated_name(name, prefix, &format!("{suffix}{sidecar}"))))
}

fn is_generated_name(name: &str, prefix: &str, suffix: &str) -> bool {
    let Some(token) = name
        .strip_prefix(prefix)
        .and_then(|value| value.strip_suffix(suffix))
    else {
        return false;
    };
    Uuid::parse_str(token)
        .is_ok_and(|uuid| uuid.get_version_num() == 4 && uuid.hyphenated().to_string() == token)
}

fn sqlite_paths(path: &Path) -> Vec<PathBuf> {
    let mut paths = vec![path.to_owned()];
    for suffix in SQLITE_SIDECARS {
        let mut sidecar: OsString = path.as_os_str().to_owned();
        sidecar.push(suffix);
        paths.push(PathBuf::from(sidecar));
    }
    paths
}

#[cfg(test)]
#[path = "restore_cleanup_fault_tests.rs"]
mod fault_tests;
#[cfg(test)]
#[path = "restore_cleanup_tests.rs"]
mod tests;
