use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::directory_capability::DirectoryCapability;
use super::file_ops::{ensure_private_directory, sync_parent};
use super::restore_state::restore_root;
use super::BackupError;

const SQLITE_SIDECARS: &[&str] = &["-wal", "-shm", "-journal"];
const WORKSPACE_PREFIXES: &[&str] = &[".bodam-snapshot-", ".bodam-verify-", ".bodam-inspect-"];
const DATABASE_PARENT_PREFIXES: &[&str] = &[".bodam-restore-", ".bodam-rollback-"];

pub(super) trait TemporaryCleanupOps: Send + Sync {
    fn remove_file(&self, path: &Path) -> io::Result<()>;
    fn sync_parent(&self, parent: &Path) -> io::Result<()>;

    fn remove_in(&self, directory: &DirectoryCapability, name: &str) -> io::Result<()> {
        self.remove_file(&directory.path().join(name))
    }

    fn sync_directory(&self, directory: &DirectoryCapability) -> io::Result<()> {
        self.sync_parent(directory.path())
    }
}

pub(super) struct OsTemporaryCleanupOps;

impl TemporaryCleanupOps for OsTemporaryCleanupOps {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> io::Result<()> {
        sync_parent(parent).map_err(|_| io::Error::other("temporary directory sync failed"))
    }

    fn remove_in(&self, directory: &DirectoryCapability, name: &str) -> io::Result<()> {
        directory.remove_regular(name)
    }

    fn sync_directory(&self, directory: &DirectoryCapability) -> io::Result<()> {
        directory.sync()
    }
}

#[derive(Clone, Copy)]
enum SweepScope {
    Workspace,
    BackupDirectory,
    DatabaseParent,
    RestoreRoot,
}

pub(super) fn workspace_root(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join("backup-work")
}

pub(super) fn prepare_workspace(
    app_data_dir: &Path,
    operations: &dyn TemporaryCleanupOps,
) -> Result<PathBuf, BackupError> {
    let root = workspace_root(app_data_dir);
    ensure_private_directory(&root)?;
    sweep_directory(&root, SweepScope::Workspace, true, operations)?;
    Ok(root)
}

pub(super) fn sweep_startup_temporary_files(
    app_data_dir: &Path,
    database_path: &Path,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    prepare_workspace(app_data_dir, operations)?;
    sweep_directory(
        &restore_root(app_data_dir),
        SweepScope::RestoreRoot,
        false,
        operations,
    )?;
    sweep_directory(
        &app_data_dir.join("backups"),
        SweepScope::BackupDirectory,
        false,
        operations,
    )?;
    let database_parent = database_path
        .parent()
        .ok_or_else(BackupError::save_failed)?;
    sweep_directory(
        database_parent,
        SweepScope::DatabaseParent,
        true,
        operations,
    )
}

pub(super) fn cleanup_workspace_database(
    path: &Path,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let name = path.file_name().and_then(|value| value.to_str());
    if !path.is_absolute() || name.is_none_or(|value| !is_workspace_name(value)) {
        return Err(BackupError::save_failed());
    }
    cleanup_paths(&sqlite_paths(path), operations)
}

pub(super) fn with_workspace_database_cleanup<T>(
    path: &Path,
    operations: &dyn TemporaryCleanupOps,
    action: impl FnOnce(&Path) -> Result<T, BackupError>,
) -> Result<T, BackupError> {
    let result = action(path);
    cleanup_workspace_database(path, operations)?;
    result
}

#[cfg(test)]
pub(super) fn cleanup_backup_archive_temporary(
    path: &Path,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let name = path.file_name().and_then(|value| value.to_str());
    if !path.is_absolute() || name.is_none_or(|value| !is_backup_archive_temporary_name(value)) {
        return Err(BackupError::save_failed());
    }
    cleanup_paths(&[path.to_owned()], operations)
}

pub(super) fn is_backup_archive_temporary_name(name: &str) -> bool {
    matches_uuid_name(name, ".bodam-backup-", ".tmp.bodam-backup")
}

pub(super) fn is_write_probe_temporary_name(name: &str) -> bool {
    matches_uuid_name(name, ".bodam-write-check-", ".tmp")
        || matches_uuid_name(name, ".bodam-write-check-", ".tmp.tmp")
}

fn is_state_temporary_name(name: &str) -> bool {
    matches_uuid_name(name, ".bodam-state-", ".tmp.json")
}

fn sweep_directory(
    root: &Path,
    scope: SweepScope,
    required: bool,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let metadata = match fs::symlink_metadata(root) {
        Ok(metadata) => metadata,
        Err(error) if !required && error.kind() == io::ErrorKind::NotFound => return Ok(()),
        Err(_) => return Err(BackupError::save_failed()),
    };
    if !root.is_absolute() || !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::save_failed());
    }
    let mut matches = Vec::new();
    for entry in fs::read_dir(root).map_err(|_| BackupError::save_failed())? {
        let entry = entry.map_err(|_| BackupError::save_failed())?;
        let Some(name) = entry.file_name().to_str().map(str::to_owned) else {
            continue;
        };
        if is_owned_name(&name, scope) {
            let metadata =
                fs::symlink_metadata(entry.path()).map_err(|_| BackupError::save_failed())?;
            if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
                return Err(BackupError::save_failed());
            }
            matches.push(entry.path());
        }
    }
    remove_preflighted(&matches, root, operations)
}

fn cleanup_paths(
    paths: &[PathBuf],
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let parent = paths
        .first()
        .and_then(|path| path.parent())
        .ok_or_else(BackupError::save_failed)?;
    let mut existing = Vec::new();
    for path in paths {
        if path.parent() != Some(parent) {
            return Err(BackupError::save_failed());
        }
        match fs::symlink_metadata(path) {
            Ok(metadata)
                if metadata.file_type().is_file() && !metadata.file_type().is_symlink() =>
            {
                existing.push(path.clone());
            }
            Err(error) if error.kind() == io::ErrorKind::NotFound => {}
            _ => return Err(BackupError::save_failed()),
        }
    }
    remove_preflighted(&existing, parent, operations)
}

fn remove_preflighted(
    paths: &[PathBuf],
    parent: &Path,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let mut failed = false;
    for path in paths {
        if operations.remove_file(path).is_err() {
            failed = true;
        }
    }
    if operations.sync_parent(parent).is_err() {
        failed = true;
    }
    if failed {
        Err(BackupError::save_failed())
    } else {
        Ok(())
    }
}

fn is_owned_name(name: &str, scope: SweepScope) -> bool {
    match scope {
        SweepScope::Workspace => WORKSPACE_PREFIXES
            .iter()
            .any(|prefix| matches_sqlite_name(name, prefix)),
        SweepScope::BackupDirectory => {
            is_backup_archive_temporary_name(name) || is_write_probe_temporary_name(name)
        }
        SweepScope::DatabaseParent => DATABASE_PARENT_PREFIXES
            .iter()
            .any(|prefix| matches_sqlite_name(name, prefix)),
        SweepScope::RestoreRoot => is_state_temporary_name(name),
    }
}

fn is_workspace_name(name: &str) -> bool {
    WORKSPACE_PREFIXES
        .iter()
        .any(|prefix| matches_uuid_name(name, prefix, ".sqlite3"))
}

fn matches_sqlite_name(name: &str, prefix: &str) -> bool {
    matches_uuid_name(name, prefix, ".sqlite3")
        || SQLITE_SIDECARS
            .iter()
            .any(|sidecar| matches_uuid_name(name, prefix, &format!(".sqlite3{sidecar}")))
}

fn matches_uuid_name(name: &str, prefix: &str, suffix: &str) -> bool {
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
#[path = "temporary_cleanup_tests.rs"]
mod tests;

#[cfg(test)]
#[path = "temporary_cleanup_state_tests.rs"]
mod state_tests;
