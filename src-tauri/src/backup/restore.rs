use std::path::{Path, PathBuf};

use chrono::{DateTime, Utc};
use serde::Serialize;
use uuid::Uuid;

use super::archive::{
    extract_verified_archive, inspect_verified_archive_in, ValidatedArchive, MAX_ARCHIVE_BYTES,
};
use super::error::BackupError;
use super::file_ops::{ensure_private_directory, is_safe_basename, sync_parent, AtomicReplacer};
use super::model::{RestoreOutcome, RestorePreview, StartupRestoreStatus};
use super::restore_candidate::prepare_working_database;
use super::restore_cleanup::{
    cleanup_completed_restore, cleanup_preview, sweep_orphaned_restore_files,
    sweep_orphaned_restore_files_except, OsRestoreRemover,
};
use super::restore_state::{
    pending_marker_path, read_marker, restore_root, safe_child, write_status, PendingMarker,
};
use super::secure_copy::copy_secure_bounded;
use super::snapshot::{copy_database, inspect_database, remove_sidecars, DatabaseDescriptor};
use super::temporary_cleanup::{prepare_workspace, OsTemporaryCleanupOps};

#[derive(Clone, Debug)]
pub(crate) struct PreparedRestore {
    pub token: String,
    pub staged_archive: PathBuf,
    pub validated: ValidatedArchive,
    pub source_basename: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct PendingRestoreResult {
    pub pre_restore_basename: String,
    pub restart_required: bool,
}

pub(crate) fn prepare_restore_preview(
    source: &Path,
    app_data_dir: &Path,
) -> Result<(PreparedRestore, RestorePreview), BackupError> {
    let source_basename = source
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| {
            is_safe_basename(value)
                && Path::new(value).extension().and_then(|part| part.to_str())
                    == Some("bodam-backup")
        })
        .ok_or_else(BackupError::path_unavailable)?
        .to_owned();
    let root = restore_root(app_data_dir);
    ensure_private_directory(&root)?;
    let token = Uuid::new_v4().to_string();
    let staged_archive = root.join(format!("restore-preview-{token}.bodam-backup"));
    let workspace = prepare_workspace(app_data_dir, &OsTemporaryCleanupOps)?;
    if let Err(error) = copy_secure_bounded(source, &staged_archive, MAX_ARCHIVE_BYTES) {
        cleanup_preview(app_data_dir, &staged_archive, &OsRestoreRemover)?;
        return Err(error);
    }
    let mut validated =
        match inspect_verified_archive_in(&staged_archive, &workspace, &OsTemporaryCleanupOps) {
            Ok(value) => value,
            Err(error) => {
                cleanup_preview(app_data_dir, &staged_archive, &OsRestoreRemover)?;
                return Err(error);
            }
        };
    validated.basename = source_basename.clone();
    let preview = RestorePreview {
        token: token.clone(),
        basename: source_basename.clone(),
        created_at_utc: validated.manifest.created_at_utc.clone(),
        reason: validated.manifest.reason,
        app_version: validated.manifest.app_version.clone(),
        schema_migration_count: validated.manifest.schema_migration_count,
        schema_last_migration: validated.manifest.schema_last_migration.clone(),
    };
    Ok((
        PreparedRestore {
            token,
            staged_archive,
            validated,
            source_basename,
        },
        preview,
    ))
}

pub(super) fn apply_pending_restore_with_replacer(
    database_path: &Path,
    app_data_dir: &Path,
    completed_at: DateTime<Utc>,
    replacer: &dyn AtomicReplacer,
) -> Result<Option<StartupRestoreStatus>, BackupError> {
    let Some(marker) = read_marker(app_data_dir)? else {
        sweep_orphaned_restore_files(app_data_dir, database_path, &OsRestoreRemover)?;
        return Ok(None);
    };
    let marker_path = pending_marker_path(app_data_dir);
    let root = restore_root(app_data_dir);
    let staged = safe_child(&root, &marker.staged_archive_basename)?;
    let safety = safe_child(&root, &marker.safety_database_basename)?;
    sweep_orphaned_restore_files_except(
        app_data_dir,
        database_path,
        &[&staged, &safety],
        &OsRestoreRemover,
    )?;
    let working = root.join(format!("restore-working-{}.sqlite3", Uuid::new_v4()));
    let replacement = database_path
        .parent()
        .ok_or_else(BackupError::restore_failed)?
        .join(format!(".bodam-restore-{}.sqlite3", Uuid::new_v4()));

    let prepared = prepare_candidate(&marker, &staged, &safety, &working, &replacement);
    let outcome = match prepared {
        Err(_) => recover_preinstall_failure(&marker, database_path, &safety, replacer)?,
        Ok(expected)
            if install_candidate(&expected, &replacement, database_path, replacer).is_ok() =>
        {
            RestoreOutcome::Restored
        }
        Ok(_) => {
            rollback(database_path, &safety, &marker, replacer)?;
            RestoreOutcome::RolledBack
        }
    };
    let status = StartupRestoreStatus {
        outcome,
        backup_basename: marker.backup_basename,
        completed_at_utc: completed_at.to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
    };
    write_status(app_data_dir, &status, replacer)?;
    cleanup_completed_restore(
        &marker_path,
        &staged,
        &safety,
        &working,
        &replacement,
        &OsRestoreRemover,
    )?;
    Ok(Some(status))
}

fn prepare_candidate(
    marker: &PendingMarker,
    staged: &Path,
    safety: &Path,
    working: &Path,
    replacement: &Path,
) -> Result<super::snapshot::DatabaseDescriptor, BackupError> {
    validate_safety(marker, safety)?;
    let staged_archive = extract_verified_archive(staged, working)?;
    if staged_archive.database.sha256 != marker.backup_database_sha256 {
        return Err(BackupError::checksum_mismatch());
    }
    let migrated = prepare_working_database(working)?;
    copy_database(working, replacement)?;
    Ok(migrated)
}

fn recover_preinstall_failure(
    marker: &PendingMarker,
    database: &Path,
    safety: &Path,
    replacer: &dyn AtomicReplacer,
) -> Result<RestoreOutcome, BackupError> {
    let current_error = match inspect_database(database, true) {
        Ok(_) => return Ok(RestoreOutcome::RolledBack),
        Err(error) => error,
    };
    if validate_safety(marker, safety).is_err() {
        return Err(current_error);
    }
    rollback(database, safety, marker, replacer)?;
    Ok(RestoreOutcome::RolledBack)
}

fn validate_safety(
    marker: &PendingMarker,
    safety: &Path,
) -> Result<DatabaseDescriptor, BackupError> {
    let descriptor = inspect_database(safety, true)?;
    if descriptor.sha256 != marker.safety_database_sha256 {
        return Err(BackupError::checksum_mismatch());
    }
    Ok(descriptor)
}

fn install_candidate(
    expected: &super::snapshot::DatabaseDescriptor,
    replacement: &Path,
    database: &Path,
    replacer: &dyn AtomicReplacer,
) -> Result<(), BackupError> {
    remove_sidecars(database)?;
    replacer
        .replace(replacement, database)
        .map_err(|_| BackupError::restore_failed())?;
    sync_parent(database.parent().ok_or_else(BackupError::restore_failed)?)
        .map_err(|_| BackupError::restore_failed())?;
    let installed = inspect_database(database, true)?;
    if installed != *expected {
        return Err(BackupError::restore_failed());
    }
    Ok(())
}

fn rollback(
    database: &Path,
    safety: &Path,
    marker: &PendingMarker,
    replacer: &dyn AtomicReplacer,
) -> Result<(), BackupError> {
    let expected =
        validate_safety(marker, safety).map_err(|_| BackupError::restore_rollback_failed())?;
    let replacement = database
        .parent()
        .ok_or_else(BackupError::restore_rollback_failed)?
        .join(format!(".bodam-rollback-{}.sqlite3", Uuid::new_v4()));
    copy_database(safety, &replacement).map_err(|_| BackupError::restore_rollback_failed())?;
    remove_sidecars(database).map_err(|_| BackupError::restore_rollback_failed())?;
    replacer
        .replace(&replacement, database)
        .map_err(|_| BackupError::restore_rollback_failed())?;
    sync_parent(
        database
            .parent()
            .ok_or_else(BackupError::restore_rollback_failed)?,
    )
    .map_err(|_| BackupError::restore_rollback_failed())?;
    let actual =
        inspect_database(database, true).map_err(|_| BackupError::restore_rollback_failed())?;
    if actual != expected {
        return Err(BackupError::restore_rollback_failed());
    }
    Ok(())
}
