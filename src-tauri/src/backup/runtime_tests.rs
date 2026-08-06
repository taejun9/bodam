use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};

use serde_json::Value;
use uuid::Uuid;

use super::directory::BackupSettingsStore;
use super::BackupRuntime;
use crate::error::AppError;

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[test]
fn selection_persists_only_the_canonical_final_directory() {
    use std::os::unix::fs::symlink;

    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let settings = Arc::new(FakeSettings::new(None));
    let runtime = runtime(&root, &app_data, settings.clone());
    let target_parent = root.directory("target-parent");
    let target = target_parent.join("canonical-backups");
    fs::create_dir(&target).unwrap();
    let alias = root.path().join("selected-parent");
    symlink(target_parent, &alias).unwrap();

    runtime
        .select_directory(alias.join("canonical-backups"))
        .unwrap();

    assert_eq!(settings.current(), Some(fs::canonicalize(target).unwrap()));
}

#[test]
fn persistence_failure_rolls_manager_back_to_the_previous_custom_directory() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let custom = root.directory("synthetic-custom");
    let settings = Arc::new(FakeSettings::new(Some(custom.clone())));
    let runtime = runtime(&root, &app_data, settings.clone());
    settings.fail_next(None);

    assert_eq!(
        runtime.use_default_directory().unwrap_err().code,
        "BACKUP_DIRECTORY_SETTINGS_UNAVAILABLE"
    );
    let default = app_data.join("backups");
    fs::remove_dir_all(default).unwrap();
    let status = encoded(runtime.load_status().unwrap());
    assert_eq!(status["location"]["kind"], "custom");
    assert_eq!(status["location"]["available"], true);
    assert_eq!(settings.current(), Some(custom));
}

#[test]
fn rollback_failure_blocks_every_backup_write_until_a_new_selection_succeeds() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let custom = root.directory("synthetic-custom");
    let settings = Arc::new(FakeSettings::new(Some(custom.clone())));
    let runtime = runtime(&root, &app_data, settings.clone());
    settings.fail_next(Some(custom));

    assert!(runtime.use_default_directory().is_err());
    assert_eq!(
        runtime.create_manual_backup().unwrap_err().code,
        "BACKUP_DIRECTORY_STATE_INCONSISTENT"
    );
    runtime
        .state()
        .unwrap()
        .lifecycle
        .remember_preview("12000000-0000-4000-8000-000000000001".into());
    assert_eq!(
        runtime
            .prepare_restore("12000000-0000-4000-8000-000000000001")
            .unwrap_err()
            .code,
        "BACKUP_DIRECTORY_STATE_INCONSISTENT"
    );
    let split_target = app_data.join("backups");
    fs::remove_dir_all(&split_target).unwrap();
    let blocked = encoded(runtime.load_status().unwrap());
    assert_eq!(blocked["available"], true);
    assert_eq!(blocked["location"]["available"], false);
    assert_eq!(blocked["automaticCount"], 0);
    assert!(!split_target.exists());

    let recovery = root.directory("synthetic-recovery");
    let recovered = encoded(runtime.select_directory(recovery.clone()).unwrap());
    assert_eq!(recovered["location"]["basename"], "synthetic-recovery");
    assert_eq!(recovered["location"]["available"], true);
    assert_eq!(settings.current(), Some(recovery));
}

#[test]
fn daily_failure_returns_a_reselectable_status_instead_of_an_error_only_view() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let custom = root.directory("synthetic-offline");
    let settings = Arc::new(FakeSettings::new(Some(custom.clone())));
    let runtime = runtime(&root, &app_data, settings);
    fs::remove_dir(custom).unwrap();

    let status = encoded(runtime.check_daily_backup().unwrap());
    assert_eq!(status["available"], true);
    assert_eq!(status["location"]["kind"], "custom");
    assert_eq!(status["location"]["available"], false);
    assert!(status["lastFailure"].as_str().is_some());
}

#[test]
fn daily_success_returns_the_combined_result_status_without_duplicate_creation() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    drop(crate::database::open(&root.path().join("synthetic.sqlite3")).unwrap());
    let runtime = runtime(&root, &app_data, Arc::new(FakeSettings::new(None)));

    let first = encoded(runtime.check_daily_backup().unwrap());
    let second = encoded(runtime.check_daily_backup().unwrap());
    assert_eq!(first["automaticCount"], 1);
    assert_eq!(second["automaticCount"], 1);
    assert_eq!(second["lastFailure"], Value::Null);
}

#[test]
fn status_keeps_a_failed_exit_recoverable_after_an_event_was_missed() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let runtime = runtime(&root, &app_data, Arc::new(FakeSettings::new(None)));
    {
        let mut state = runtime.state().unwrap();
        assert!(state.lifecycle.begin_initial_exit_backup());
        state.lifecycle.mark_exit_failure();
    }

    let status = encoded(runtime.load_status().unwrap());
    assert_eq!(status["exitFailurePending"], true);
    assert!(!runtime.begin_exit_backup().unwrap());
    assert!(runtime.exit_failure_pending());
}

fn runtime(root: &TestRoot, app_data: &Path, settings: Arc<FakeSettings>) -> BackupRuntime {
    let store: Arc<dyn BackupSettingsStore> = settings;
    BackupRuntime::with_settings(
        root.path().join("synthetic.sqlite3"),
        app_data.to_owned(),
        "0.1.0".into(),
        None,
        store,
    )
    .unwrap()
}

fn encoded(value: impl serde::Serialize) -> Value {
    serde_json::to_value(value).unwrap()
}

struct FakeSettings {
    custom: Mutex<Option<PathBuf>>,
    fail: AtomicBool,
    remove_on_failure: Mutex<Option<PathBuf>>,
}

impl FakeSettings {
    fn new(custom: Option<PathBuf>) -> Self {
        Self {
            custom: Mutex::new(custom),
            fail: AtomicBool::new(false),
            remove_on_failure: Mutex::new(None),
        }
    }

    fn fail_next(&self, remove: Option<PathBuf>) {
        *self.remove_on_failure.lock().unwrap() = remove;
        self.fail.store(true, Ordering::SeqCst);
    }

    fn current(&self) -> Option<PathBuf> {
        self.custom.lock().unwrap().clone()
    }

    fn persist(&self, value: Option<PathBuf>) -> Result<(), AppError> {
        if self.fail.swap(false, Ordering::SeqCst) {
            if let Some(path) = self.remove_on_failure.lock().unwrap().take() {
                fs::remove_dir_all(path).unwrap();
            }
            return Err(AppError::Database);
        }
        *self.custom.lock().unwrap() = value;
        Ok(())
    }
}

impl BackupSettingsStore for FakeSettings {
    fn custom_backup_directory(&self) -> Result<Option<PathBuf>, AppError> {
        Ok(self.current())
    }

    fn set_custom_backup_directory(&self, directory: &Path) -> Result<(), AppError> {
        self.persist(Some(directory.to_owned()))
    }

    fn clear_custom_backup_directory(&self) -> Result<(), AppError> {
        self.persist(None)
    }
}

struct TestRoot(PathBuf);

impl TestRoot {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-runtime-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(fs::canonicalize(path).unwrap())
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn directory(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        fs::create_dir(&path).unwrap();
        path
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
