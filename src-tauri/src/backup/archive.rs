use std::fs::{self, File};
use std::path::Path;

use uuid::Uuid;

use super::archive_format::extract_verified_archive_file;
#[cfg(test)]
use super::archive_format::{
    verify_manifest_database, write_archive_payload, DATABASE_ENTRY, MANIFEST_ENTRY,
};
use super::error::BackupError;
use super::file_ops::is_safe_basename;
#[cfg(test)]
use super::file_ops::{
    random_sibling, sync_parent, validate_user_directory, AtomicReplacer, SecureFile,
};
use super::model::BackupManifest;
#[cfg(test)]
use super::snapshot::inspect_database;
use super::snapshot::DatabaseDescriptor;
#[cfg(test)]
use super::temporary_cleanup::cleanup_backup_archive_temporary;
#[cfg(test)]
use super::temporary_cleanup::OsTemporaryCleanupOps;
use super::temporary_cleanup::{with_workspace_database_cleanup, TemporaryCleanupOps};

pub(crate) const MAX_DATABASE_BYTES: u64 = 2 * 1024 * 1024 * 1024;
pub(super) const MAX_ARCHIVE_BYTES: u64 = MAX_DATABASE_BYTES + 1024 * 1024;

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ValidatedArchive {
    pub manifest: BackupManifest,
    pub database: DatabaseDescriptor,
    pub basename: String,
}

#[cfg(test)]
pub(crate) fn write_verified_archive(
    target: &Path,
    snapshot_path: &Path,
    manifest: &BackupManifest,
    replacer: &dyn AtomicReplacer,
) -> Result<ValidatedArchive, BackupError> {
    let workspace = snapshot_path
        .parent()
        .ok_or_else(BackupError::path_unavailable)?;
    write_verified_archive_with_ops(
        target,
        snapshot_path,
        workspace,
        manifest,
        replacer,
        &OsTemporaryCleanupOps,
    )
}

#[cfg(test)]
pub(super) fn write_verified_archive_with_ops(
    target: &Path,
    snapshot_path: &Path,
    workspace: &Path,
    manifest: &BackupManifest,
    replacer: &dyn AtomicReplacer,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<ValidatedArchive, BackupError> {
    let basename = validate_artifact_path(target, true)?;
    manifest.validate(MAX_DATABASE_BYTES)?;
    let snapshot = inspect_database(snapshot_path, false)?;
    verify_manifest_database(manifest, &snapshot)?;
    let parent = target.parent().ok_or_else(BackupError::path_unavailable)?;
    validate_user_directory(parent)?;
    let temporary = random_sibling(parent, "bodam-backup", "bodam-backup");
    let mut guard = SecureFile::create(&temporary)?;
    let file = guard.take_file()?;
    let candidate = (|| {
        write_archive_payload(file, snapshot_path, manifest)?;

        let verify_path = workspace.join(format!(".bodam-verify-{}.sqlite3", Uuid::new_v4()));
        let verified = with_workspace_database_cleanup(&verify_path, cleanup, |destination| {
            extract_verified_archive(&temporary, destination)
        })?;
        if verified.manifest != *manifest {
            return Err(BackupError::checksum_mismatch());
        }
        Ok(verified)
    })();
    let mut verified = match candidate {
        Ok(verified) => verified,
        Err(error) => {
            guard.close();
            cleanup_backup_archive_temporary(&temporary, cleanup)?;
            return Err(error);
        }
    };
    replacer
        .replace(&temporary, target)
        .map_err(|_| BackupError::save_failed())
        .or_else(|error| {
            guard.close();
            cleanup_backup_archive_temporary(&temporary, cleanup)?;
            Err(error)
        })?;
    guard.keep();
    sync_parent(parent)?;
    verified.basename = basename;
    Ok(verified)
}

pub(crate) fn extract_verified_archive(
    source: &Path,
    destination: &Path,
) -> Result<ValidatedArchive, BackupError> {
    let basename = validate_artifact_path(source, false)?;
    let file = File::open(source).map_err(|_| BackupError::archive_invalid())?;
    extract_verified_archive_file(file, basename, destination)
}

#[cfg(test)]
pub(crate) fn inspect_verified_archive(source: &Path) -> Result<ValidatedArchive, BackupError> {
    let workspace = source.parent().ok_or_else(BackupError::path_unavailable)?;
    inspect_verified_archive_in(source, workspace, &OsTemporaryCleanupOps)
}

pub(super) fn inspect_verified_archive_in(
    source: &Path,
    workspace: &Path,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<ValidatedArchive, BackupError> {
    let destination = workspace.join(format!(".bodam-inspect-{}.sqlite3", Uuid::new_v4()));
    with_workspace_database_cleanup(&destination, cleanup, |destination| {
        extract_verified_archive(source, destination)
    })
}

fn validate_artifact_path(path: &Path, allow_missing: bool) -> Result<String, BackupError> {
    if !path.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    let basename = path
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| validate_artifact_basename(value).is_ok())
        .ok_or_else(BackupError::path_unavailable)?;
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() && !metadata.file_type().is_symlink() => {}
        Err(error) if allow_missing && error.kind() == std::io::ErrorKind::NotFound => {}
        _ => return Err(BackupError::path_unavailable()),
    }
    Ok(basename.to_owned())
}

pub(super) fn validate_artifact_basename(value: &str) -> Result<(), BackupError> {
    if !is_safe_basename(value)
        || Path::new(value).extension().and_then(|part| part.to_str()) != Some("bodam-backup")
    {
        return Err(BackupError::path_unavailable());
    }
    Ok(())
}

#[cfg(test)]
#[path = "archive_tests.rs"]
mod tests;
