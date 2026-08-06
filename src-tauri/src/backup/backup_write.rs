use std::path::Path;

use chrono::{DateTime, SecondsFormat, Utc};
use uuid::Uuid;

use super::archive_capability::write_verified_archive_in;
use super::clock::ClockReading;
use super::directory_capability::DirectoryCapability;
use super::file_ops::AtomicReplacer;
use super::model::{BackupManifest, BackupReason, BackupResult, BACKUP_FORMAT_VERSION};
use super::retention::{RetentionRemover, VerifiedBackupCatalog};
use super::snapshot::create_online_snapshot;
use super::temporary_cleanup::{cleanup_workspace_database, TemporaryCleanupOps};
use super::BackupError;

#[allow(clippy::too_many_arguments)]
pub(super) fn create_backup(
    database_path: &Path,
    workspace: &Path,
    directory: &DirectoryCapability,
    target_basename: &str,
    reason: BackupReason,
    reading: ClockReading,
    app_version: &str,
    changed_only: bool,
    mut catalog: Option<&mut VerifiedBackupCatalog>,
    replacer: &dyn AtomicReplacer,
    retention_remover: &dyn RetentionRemover,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<BackupResult, BackupError> {
    let snapshot_path = workspace.join(format!(".bodam-snapshot-{}.sqlite3", Uuid::new_v4()));
    let snapshot = match create_online_snapshot(database_path, &snapshot_path) {
        Ok(snapshot) => snapshot,
        Err(error) => {
            cleanup_workspace_database(&snapshot_path, cleanup)?;
            return Err(error);
        }
    };
    if changed_only
        && catalog.as_ref().and_then(|value| value.latest_checksum())
            == Some(snapshot.sha256.as_str())
    {
        cleanup_workspace_database(&snapshot_path, cleanup)?;
        return Ok(not_created());
    }
    let manifest = BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        created_at_utc: reading.utc.to_rfc3339_opts(SecondsFormat::Millis, true),
        local_date: reading.local_date.format("%Y-%m-%d").to_string(),
        reason,
        app_version: app_version.to_owned(),
        schema_migration_count: snapshot.schema.migration_count,
        schema_last_migration: snapshot.schema.last_migration_name,
        database_size_bytes: snapshot.size_bytes,
        database_sha256: snapshot.sha256,
    };
    let saved = write_verified_archive_in(
        directory,
        target_basename,
        &snapshot_path,
        workspace,
        &manifest,
        replacer,
        cleanup,
    );
    let cleaned = cleanup_workspace_database(&snapshot_path, cleanup);
    cleaned?;
    let saved = saved?;
    let retention = if reason.is_automatic() {
        let catalog = catalog.as_mut().ok_or_else(BackupError::save_failed)?;
        catalog.insert_verified(&saved)?;
        catalog.enforce_automatic_retention(retention_remover)
    } else {
        Default::default()
    };
    Ok(BackupResult {
        created: true,
        basename: Some(saved.basename),
        manifest: Some(saved.manifest),
        retention_warning_count: retention.warning_count,
    })
}

pub(super) fn artifact_basename(reason: BackupReason, created_at: DateTime<Utc>) -> String {
    format!(
        "BODAM-{}-{}-{}.bodam-backup",
        reason.filename_segment(),
        created_at.format("%Y%m%dT%H%M%S%3fZ"),
        Uuid::new_v4()
    )
}

pub(super) fn not_created() -> BackupResult {
    BackupResult {
        created: false,
        basename: None,
        manifest: None,
        retention_warning_count: 0,
    }
}
