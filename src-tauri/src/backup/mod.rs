mod app_lifecycle;
mod archive;
mod archive_capability;
mod archive_format;
mod backup_destination;
mod backup_write;
mod clock;
mod commands;
mod directory_capability;
mod directory_capability_probe;
#[cfg(any(target_os = "macos", target_os = "linux"))]
mod directory_capability_unix;
mod directory_identity;
mod error;
mod file_ops;
mod manager;
mod manager_backup;
mod model;
mod restore;
mod restore_candidate;
mod restore_cleanup;
mod restore_preview_discard;
mod restore_stage;
mod restore_state;
mod retention;
mod runtime;
mod secure_copy;
mod snapshot;
mod temporary_cleanup;
mod temporary_cleanup_capability;

pub(crate) use app_lifecycle::handle_run_event;
pub(crate) use commands::{
    acknowledge_restore_startup, check_daily_backup, choose_backup_directory,
    choose_restore_backup, create_manual_backup, discard_restore_preview, exit_without_backup,
    load_backup_status, prepare_backup_restore, restart_for_backup_restore, retry_exit_backup,
    use_default_backup_directory,
};
pub(crate) use error::BackupError;
pub(crate) use manager::BackupManager;
pub(crate) use model::{BackupResult, BackupStatus, StartupRestoreStatus};
pub(crate) use restore_state::{
    acknowledge_status as acknowledge_startup_status, read_status as read_startup_status,
};
pub(crate) use runtime::BackupRuntime;

pub(crate) fn apply_pending_restore(
    database_path: &std::path::Path,
    app_data_dir: &std::path::Path,
    completed_at: chrono::DateTime<chrono::Utc>,
) -> Result<Option<StartupRestoreStatus>, BackupError> {
    temporary_cleanup::sweep_startup_temporary_files(
        app_data_dir,
        database_path,
        &temporary_cleanup::OsTemporaryCleanupOps,
    )?;
    restore::apply_pending_restore_with_replacer(
        database_path,
        app_data_dir,
        completed_at,
        &file_ops::OsAtomicReplacer,
    )
}

#[cfg(test)]
mod manager_tests;
#[cfg(test)]
mod restore_phase_tests;
#[cfg(test)]
mod restore_preview_discard_tests;
#[cfg(test)]
mod restore_snapshot_cleanup_tests;
#[cfg(test)]
mod restore_tests;
#[cfg(test)]
mod tests;
