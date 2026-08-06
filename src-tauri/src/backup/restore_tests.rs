use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::{TimeZone, Utc};
use rusqlite::Connection;
use uuid::Uuid;

use super::clock::{BackupClock, ClockReading};
use super::file_ops::{AtomicReplacer, OsAtomicReplacer};
use super::manager::BackupManager;
use super::model::RestoreOutcome;
use super::restore::apply_pending_restore_with_replacer;
use super::restore_state::{acknowledge_status, pending_marker_path, read_status, restore_root};
use super::retention::OsRetentionRemover;
use crate::database;

#[test]
fn failed_database_install_rolls_back_and_cleans_restore_state() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    stage_restore(&fixture, &manager);
    let replacer = FailOnceDatabaseReplacer {
        database: fixture.database.clone(),
        failed: AtomicBool::new(false),
    };

    let status = apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &replacer,
    )
    .unwrap()
    .unwrap();

    assert_eq!(status.outcome, RestoreOutcome::RolledBack);
    assert_eq!(customer_name(&fixture.database), "합성 after");
    assert_eq!(acknowledge_startup(&fixture.root), status);
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
}

#[test]
fn corrupted_staged_archive_rolls_back_without_touching_current_data() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    stage_restore(&fixture, &manager);
    let root = restore_root(&fixture.root);
    let staged = fs::read_dir(&root)
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with("restore-preview-"))
        })
        .unwrap();
    fs::write(staged, b"synthetic corruption").unwrap();

    let status = apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap()
    .unwrap();

    assert_eq!(status.outcome, RestoreOutcome::RolledBack);
    assert_eq!(customer_name(&fixture.database), "합성 after");
    assert_eq!(acknowledge_startup(&fixture.root), status);
    assert_eq!(files_in(&root), 0);
}

#[test]
fn marker_write_failure_removes_raw_safety_snapshot() {
    let fixture = Fixture::new();
    let replacer = Arc::new(FailTargetReplacer {
        target: pending_marker_path(&fixture.root),
    });
    let manager = fixture.manager_with_replacer(replacer);
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let preview = manager.preview_restore(&artifact).unwrap();

    let error = manager.confirm_restore(&preview.token).unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    let names = fs::read_dir(restore_root(&fixture.root))
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect::<Vec<_>>();
    assert_eq!(names.len(), 1);
    assert!(names[0].starts_with("restore-preview-"));
}

#[test]
fn restored_archive_clears_a_foreign_host_backup_path() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let connection = database::open(&fixture.database).unwrap();
    connection
        .execute(
            "UPDATE app_settings SET custom_backup_directory = ?1 WHERE id = 1",
            [r"\\synthetic-server\private-share"],
        )
        .unwrap();
    drop(connection);
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let preview = manager.preview_restore(&artifact).unwrap();
    manager.confirm_restore(&preview.token).unwrap();

    apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap()
    .unwrap();

    assert_eq!(custom_backup_directory(&fixture.database), None);
    acknowledge_startup(&fixture.root);
}

#[test]
fn abandoned_preview_is_removed_on_the_next_markerless_startup() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    manager.preview_restore(&artifact).unwrap();
    drop(manager);
    assert_eq!(files_in(&restore_root(&fixture.root)), 1);

    let result = apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap();

    assert_eq!(result, None);
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
}

fn stage_restore(fixture: &Fixture, manager: &BackupManager) {
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let connection = database::open(&fixture.database).unwrap();
    connection
        .execute(
            "UPDATE customers SET name = '합성 after' WHERE id = 'committed'",
            [],
        )
        .unwrap();
    drop(connection);
    let preview = manager.preview_restore(&artifact).unwrap();
    manager.confirm_restore(&preview.token).unwrap();
}

fn customer_name(database_path: &Path) -> String {
    Connection::open(database_path)
        .unwrap()
        .query_row(
            "SELECT name FROM customers WHERE id = 'committed'",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

fn custom_backup_directory(database_path: &Path) -> Option<String> {
    Connection::open(database_path)
        .unwrap()
        .query_row(
            "SELECT custom_backup_directory FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

fn acknowledge_startup(app_data_dir: &Path) -> super::StartupRestoreStatus {
    let status = read_status(app_data_dir).unwrap().unwrap();
    acknowledge_status(app_data_dir, &status).unwrap();
    status
}

fn files_in(path: &Path) -> usize {
    fs::read_dir(path)
        .map(|entries| entries.count())
        .unwrap_or(0)
}

struct FailOnceDatabaseReplacer {
    database: PathBuf,
    failed: AtomicBool,
}

impl AtomicReplacer for FailOnceDatabaseReplacer {
    fn replace(&self, source: &Path, target: &Path) -> io::Result<()> {
        if target == self.database && !self.failed.swap(true, Ordering::SeqCst) {
            return Err(io::Error::other("synthetic"));
        }
        OsAtomicReplacer.replace(source, target)
    }
}

struct FailTargetReplacer {
    target: PathBuf,
}

impl AtomicReplacer for FailTargetReplacer {
    fn replace(&self, source: &Path, target: &Path) -> io::Result<()> {
        if target == self.target {
            return Err(io::Error::other("synthetic"));
        }
        OsAtomicReplacer.replace(source, target)
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    backups: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-restore-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        let connection = database::open(&database).unwrap();
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES ('committed', '합성 before')",
                [],
            )
            .unwrap();
        drop(connection);
        let backups = root.join("backups");
        Self {
            root,
            database,
            backups,
        }
    }

    fn manager(&self) -> BackupManager {
        self.manager_with_replacer(Arc::new(OsAtomicReplacer))
    }

    fn manager_with_replacer(&self, replacer: Arc<dyn AtomicReplacer>) -> BackupManager {
        BackupManager::with_dependencies(
            self.database.clone(),
            self.root.clone(),
            self.backups.clone(),
            "0.1.0".into(),
            Arc::new(FixedClock),
            replacer,
            Arc::new(OsRetentionRemover),
        )
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

struct FixedClock;

impl BackupClock for FixedClock {
    fn now(&self) -> ClockReading {
        fixed_reading()
    }
}

fn fixed_reading() -> ClockReading {
    ClockReading {
        utc: Utc.with_ymd_and_hms(2026, 8, 7, 1, 2, 3).unwrap(),
        local_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
    }
}
