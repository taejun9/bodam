use std::path::Path;

use uuid::Uuid;

use super::archive::{validate_artifact_basename, ValidatedArchive, MAX_DATABASE_BYTES};
use super::archive_format::{
    extract_verified_archive_file, extract_verified_archive_file_with_handle,
    verify_manifest_database, write_archive_payload,
};
use super::directory_capability::DirectoryCapability;
use super::file_ops::AtomicReplacer;
use super::model::BackupManifest;
use super::snapshot::inspect_database;
use super::temporary_cleanup::{with_workspace_database_cleanup, TemporaryCleanupOps};
use super::temporary_cleanup_capability::cleanup_backup_archive_temporary_in;
use super::BackupError;

#[path = "archive_file_identity.rs"]
mod file_identity;

use file_identity::OpenFileIdentity;

#[allow(clippy::too_many_arguments)]
pub(super) fn write_verified_archive_in(
    directory: &DirectoryCapability,
    target_basename: &str,
    snapshot_path: &Path,
    workspace: &Path,
    manifest: &BackupManifest,
    replacer: &dyn AtomicReplacer,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<ValidatedArchive, BackupError> {
    validate_artifact_basename(target_basename)?;
    manifest.validate(MAX_DATABASE_BYTES)?;
    let snapshot = inspect_database(snapshot_path, false)?;
    verify_manifest_database(manifest, &snapshot)?;
    let temporary = format!(".bodam-backup-{}.tmp.bodam-backup", Uuid::new_v4());
    let file = directory.create_new(&temporary)?;
    let candidate = (|| {
        write_archive_payload(file, snapshot_path, manifest)?;
        let verify_path = workspace.join(format!(".bodam-verify-{}.sqlite3", Uuid::new_v4()));
        let (verified, validation_file) =
            with_workspace_database_cleanup(&verify_path, cleanup, |destination| {
                let file = directory.open_regular(&temporary)?;
                extract_verified_archive_file_with_handle(file, temporary.clone(), destination)
            })?;
        if verified.manifest != *manifest {
            return Err(BackupError::checksum_mismatch());
        }
        let validation_identity = OpenFileIdentity::hold(validation_file);
        let named_temporary = directory.open_regular(&temporary)?;
        validation_identity
            .ensure_matches(&named_temporary)
            .map_err(|_| BackupError::save_failed())?;
        Ok((verified, validation_identity))
    })();
    let (verified, validation_identity) = match candidate {
        Ok(verified) => verified,
        Err(error) => {
            cleanup_backup_archive_temporary_in(directory, &temporary, cleanup)?;
            return Err(error);
        }
    };
    replacer
        .replace_in(directory, &temporary, target_basename)
        .map_err(|_| BackupError::save_failed())
        .or_else(|error| {
            cleanup_backup_archive_temporary_in(directory, &temporary, cleanup)?;
            Err(error)
        })?;
    cleanup
        .sync_directory(directory)
        .map_err(|_| BackupError::save_failed())?;
    directory.ensure_path_identity()?;
    let final_file = directory
        .open_regular(target_basename)
        .map_err(|_| BackupError::save_failed())?;
    validation_identity
        .ensure_matches(&final_file)
        .map_err(|_| BackupError::save_failed())?;
    let verify_path = workspace.join(format!(".bodam-verify-{}.sqlite3", Uuid::new_v4()));
    let (final_archive, final_validation_file) =
        with_workspace_database_cleanup(&verify_path, cleanup, |destination| {
            extract_verified_archive_file_with_handle(
                final_file,
                target_basename.to_owned(),
                destination,
            )
        })
        .map_err(|_| BackupError::save_failed())?;
    if final_archive.manifest != verified.manifest || final_archive.database != verified.database {
        return Err(BackupError::save_failed());
    }
    let final_validation_identity = OpenFileIdentity::hold(final_validation_file);
    let named_final = directory
        .open_regular(target_basename)
        .map_err(|_| BackupError::save_failed())?;
    final_validation_identity
        .ensure_matches(&named_final)
        .map_err(|_| BackupError::save_failed())?;
    directory.ensure_path_identity()?;
    Ok(final_archive)
}

pub(super) fn inspect_verified_archive_file_in(
    directory: &DirectoryCapability,
    basename: &str,
    workspace: &Path,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<ValidatedArchive, BackupError> {
    validate_artifact_basename(basename)?;
    let destination = workspace.join(format!(".bodam-inspect-{}.sqlite3", Uuid::new_v4()));
    with_workspace_database_cleanup(&destination, cleanup, |destination| {
        let file = directory.open_regular(basename)?;
        extract_verified_archive_file(file, basename.to_owned(), destination)
    })
}

#[cfg(test)]
#[path = "archive_capability_tests.rs"]
mod tests;
