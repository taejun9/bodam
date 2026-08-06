use std::path::Path;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use super::archive_capability::write_verified_archive_in;
use super::directory_capability::DirectoryCapability;
use super::file_ops::{ensure_private_directory, AtomicReplacer};
use super::model::{BackupManifest, BackupReason, BACKUP_FORMAT_VERSION};
use super::restore::{PendingRestoreResult, PreparedRestore};
use super::restore_cleanup::{cleanup_safety, OsRestoreRemover};
use super::restore_state::{basename, restore_root, write_marker, PendingMarker};
use super::snapshot::create_online_snapshot;
use super::temporary_cleanup::{prepare_workspace, OsTemporaryCleanupOps};
use super::BackupError;

#[allow(clippy::too_many_arguments)]
pub(super) fn stage_pending_restore(
    prepared: &PreparedRestore,
    current_database: &Path,
    app_data_dir: &Path,
    backup_directory: &DirectoryCapability,
    app_version: &str,
    created_at: DateTime<Utc>,
    local_date: &str,
    replacer: &dyn AtomicReplacer,
) -> Result<PendingRestoreResult, BackupError> {
    let root = restore_root(app_data_dir);
    ensure_private_directory(&root)?;
    let workspace = prepare_workspace(app_data_dir, &OsTemporaryCleanupOps)?;
    let safety = root.join(format!("restore-safety-{}.sqlite3", Uuid::new_v4()));
    let safety_descriptor = match create_online_snapshot(current_database, &safety) {
        Ok(descriptor) => descriptor,
        Err(error) => {
            cleanup_safety(app_data_dir, &safety, &OsRestoreRemover)?;
            return Err(error);
        }
    };
    let manifest = BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        created_at_utc: created_at.to_rfc3339_opts(SecondsFormat::Millis, true),
        local_date: local_date.to_owned(),
        reason: BackupReason::PreRestore,
        app_version: app_version.to_owned(),
        schema_migration_count: safety_descriptor.schema.migration_count,
        schema_last_migration: safety_descriptor.schema.last_migration_name.clone(),
        database_size_bytes: safety_descriptor.size_bytes,
        database_sha256: safety_descriptor.sha256.clone(),
    };
    let artifact = artifact_basename(created_at);
    let staged = (|| {
        let saved = write_verified_archive_in(
            backup_directory,
            &artifact,
            &safety,
            &workspace,
            &manifest,
            replacer,
            &OsTemporaryCleanupOps,
        )?;
        let marker = PendingMarker::new(
            basename(&prepared.staged_archive)?,
            basename(&safety)?,
            prepared.source_basename.clone(),
            prepared.validated.database.sha256.clone(),
            safety_descriptor.sha256,
        );
        write_marker(app_data_dir, &marker, replacer)?;
        Ok(PendingRestoreResult {
            pre_restore_basename: saved.basename,
            restart_required: true,
        })
    })();
    if staged.is_err() {
        cleanup_safety(app_data_dir, &safety, &OsRestoreRemover)?;
    }
    staged
}

fn artifact_basename(created_at: DateTime<Utc>) -> String {
    format!(
        "BODAM-{}-{}-{}.bodam-backup",
        BackupReason::PreRestore.filename_segment(),
        created_at.format("%Y%m%dT%H%M%S%3fZ"),
        Uuid::new_v4()
    )
}
