use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::Value;
use uuid::Uuid;

use super::{OsStartupStatusAcknowledger, StartupStatusAcknowledger};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::model::{RestoreOutcome, StartupRestoreStatus};
use crate::backup::restore_state::write_status;
use crate::backup::retention::{archive_inspection_count, reset_archive_inspection_count};
use crate::backup::runtime::directory::BackupSettingsStore;
use crate::backup::runtime::BackupRuntime;
use crate::backup::{acknowledge_startup_status, read_startup_status, BackupError};
use crate::error::AppError;

#[test]
fn load_status_repeats_startup_until_explicit_acknowledgement() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let status = restored_status();
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();
    let runtime = runtime(
        &root,
        app_data.clone(),
        status.clone(),
        Arc::new(OsStartupStatusAcknowledger),
    );

    let unrelated = encoded(runtime.status_locked().unwrap());
    assert_eq!(unrelated["restoreStartup"], Value::Null);
    assert_eq!(
        read_startup_status(&app_data).unwrap(),
        Some(status.clone())
    );

    let first = encoded(runtime.load_status().unwrap());
    assert_eq!(first["restoreStartup"]["outcome"], "restored");
    assert_eq!(read_startup_status(&app_data).unwrap(), Some(status));
    let second = encoded(runtime.load_status().unwrap());
    assert_eq!(second["restoreStartup"], first["restoreStartup"]);

    runtime.acknowledge_restore_startup().unwrap();
    assert_eq!(read_startup_status(&app_data).unwrap(), None);
    let cleared = encoded(runtime.load_status().unwrap());
    assert_eq!(cleared["restoreStartup"], Value::Null);
}

#[test]
fn stale_disk_status_is_not_consumed_and_memory_remains_loadable() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let status = restored_status();
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();
    let runtime = runtime(
        &root,
        app_data.clone(),
        status,
        Arc::new(OsStartupStatusAcknowledger),
    );
    let first = encoded(runtime.load_status().unwrap());
    let replacement = restored_status_with_basename("BODAM-manual-newer.bodam-backup");
    write_status(&app_data, &replacement, &OsAtomicReplacer).unwrap();

    assert_eq!(
        runtime.acknowledge_restore_startup().unwrap_err().code,
        "RESTORE_FAILED"
    );
    assert_eq!(read_startup_status(&app_data).unwrap(), Some(replacement));
    let second = encoded(runtime.load_status().unwrap());
    assert_eq!(second["restoreStartup"], first["restoreStartup"]);
}

#[test]
fn externally_cleared_disk_status_leaves_memory_loadable() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let status = restored_status();
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();
    let runtime = runtime(
        &root,
        app_data.clone(),
        status.clone(),
        Arc::new(OsStartupStatusAcknowledger),
    );
    let first = encoded(runtime.load_status().unwrap());
    acknowledge_startup_status(&app_data, &status).unwrap();

    assert_eq!(
        runtime.acknowledge_restore_startup().unwrap_err().code,
        "RESTORE_FAILED"
    );
    let second = encoded(runtime.load_status().unwrap());
    assert_eq!(second["restoreStartup"], first["restoreStartup"]);
}

#[test]
fn acknowledgement_failure_preserves_disk_and_memory_for_retry() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let status = restored_status();
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();
    let runtime = runtime(
        &root,
        app_data.clone(),
        status.clone(),
        Arc::new(FailOnceAcknowledger(AtomicBool::new(true))),
    );

    let first = encoded(runtime.load_status().unwrap());
    assert_eq!(first["restoreStartup"]["outcome"], "restored");
    assert_eq!(
        runtime.acknowledge_restore_startup().unwrap_err().code,
        "RESTORE_FAILED"
    );
    assert_eq!(read_startup_status(&app_data).unwrap(), Some(status));

    let retried = encoded(runtime.load_status().unwrap());
    assert_eq!(retried["restoreStartup"], first["restoreStartup"]);
    runtime.acknowledge_restore_startup().unwrap();
    assert_eq!(read_startup_status(&app_data).unwrap(), None);
    let cleared = encoded(runtime.load_status().unwrap());
    assert_eq!(cleared["restoreStartup"], Value::Null);
}

#[test]
fn runtime_initialization_failure_never_acknowledges_status() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let invalid_database = root.directory("database-is-a-directory");
    let status = restored_status();
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();

    assert!(BackupRuntime::open(
        invalid_database,
        app_data.clone(),
        "0.1.0".into(),
        Some(status.clone()),
    )
    .is_err());
    assert_eq!(read_startup_status(&app_data).unwrap(), Some(status));
}

#[test]
fn daily_failure_reuses_the_first_catalog_without_a_status_rescan() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let database = root.path().join("bodam.sqlite3");
    drop(crate::database::open(&database).unwrap());
    let runtime = BackupRuntime::build(
        database.clone(),
        app_data,
        "0.1.0".into(),
        None,
        Arc::new(StaticSettings),
        Arc::new(OsStartupStatusAcknowledger),
    )
    .unwrap();
    runtime.create_manual_backup().unwrap();
    let connection = rusqlite::Connection::open(database).unwrap();
    connection.execute("DROP TABLE customers", []).unwrap();
    drop(connection);
    reset_archive_inspection_count();

    let status = encoded(runtime.check_daily_backup().unwrap());

    assert_eq!(archive_inspection_count(), 1);
    assert_eq!(status["automaticCount"], 0);
    assert!(status["lastSuccessfulAt"].is_string());
    assert!(status["lastFailure"].is_string());
}

fn runtime(
    root: &TestRoot,
    app_data: PathBuf,
    status: StartupRestoreStatus,
    acknowledger: Arc<dyn StartupStatusAcknowledger>,
) -> BackupRuntime {
    let database = root.path().join("bodam.sqlite3");
    drop(crate::database::open(&database).unwrap());
    BackupRuntime::build(
        database,
        app_data,
        "0.1.0".into(),
        Some(status),
        Arc::new(StaticSettings),
        acknowledger,
    )
    .unwrap()
}

fn restored_status() -> StartupRestoreStatus {
    restored_status_with_basename("BODAM-manual-safe.bodam-backup")
}

fn restored_status_with_basename(backup_basename: &str) -> StartupRestoreStatus {
    StartupRestoreStatus {
        outcome: RestoreOutcome::Restored,
        backup_basename: backup_basename.into(),
        completed_at_utc: "2026-08-07T01:02:03.004Z".into(),
    }
}

fn encoded(value: impl serde::Serialize) -> Value {
    serde_json::to_value(value).unwrap()
}

struct FailOnceAcknowledger(AtomicBool);

impl StartupStatusAcknowledger for FailOnceAcknowledger {
    fn acknowledge(
        &self,
        app_data_dir: &Path,
        expected: &StartupRestoreStatus,
    ) -> Result<(), BackupError> {
        if self.0.swap(false, Ordering::SeqCst) {
            return Err(BackupError::restore_failed());
        }
        acknowledge_startup_status(app_data_dir, expected)
    }
}

struct StaticSettings;

impl BackupSettingsStore for StaticSettings {
    fn custom_backup_directory(&self) -> Result<Option<PathBuf>, AppError> {
        Ok(None)
    }

    fn set_custom_backup_directory(&self, _directory: &Path) -> Result<(), AppError> {
        Ok(())
    }

    fn clear_custom_backup_directory(&self) -> Result<(), AppError> {
        Ok(())
    }
}

struct TestRoot(PathBuf);

impl TestRoot {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-runtime-status-{}", Uuid::new_v4()));
        std::fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn directory(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        std::fs::create_dir(&path).unwrap();
        path
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        let _ = std::fs::remove_dir_all(&self.0);
    }
}
