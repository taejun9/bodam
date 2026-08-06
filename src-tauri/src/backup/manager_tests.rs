use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Barrier};
use std::thread;

use chrono::{TimeZone, Utc};
use uuid::Uuid;

use super::archive::inspect_verified_archive;
use super::clock::{BackupClock, ClockReading};
use super::file_ops::OsAtomicReplacer;
use super::manager::BackupManager;
use super::model::BackupReason;
use super::restore_state::restore_root;
use super::retention::{
    archive_inspection_count, reset_archive_inspection_count, OsRetentionRemover,
};
use crate::database;

#[test]
fn daily_is_idempotent_and_exit_tracks_database_changes() {
    let fixture = Fixture::new("schedule");
    let manager = fixture.manager(Arc::new(FixedClock));

    assert!(manager.create_daily_if_due().unwrap().created);
    assert!(!manager.create_daily_if_due().unwrap().created);
    assert!(!manager.create_exit_if_changed().unwrap().created);

    let connection = database::open(&fixture.database).unwrap();
    connection
        .execute(
            "UPDATE customers SET name = '합성 changed' WHERE id = 'committed'",
            [],
        )
        .unwrap();
    drop(connection);

    assert!(manager.create_exit_if_changed().unwrap().created);
    assert!(!manager.create_exit_if_changed().unwrap().created);
    assert_eq!(fs::read_dir(&fixture.backups).unwrap().count(), 2);
}

#[test]
fn combined_daily_status_inspects_each_existing_archive_once() {
    let fixture = Fixture::new("single-scan");
    let manager = fixture.manager(Arc::new(FixedClock));
    assert!(manager.create_daily_if_due().unwrap().created);
    reset_archive_inspection_count();

    let (result, status) = manager.check_daily_and_status();
    let result = result.unwrap();

    assert!(!result.created);
    assert_eq!(status.automatic_count, 1);
    assert_eq!(archive_inspection_count(), 1);
}

#[test]
fn concurrent_operation_returns_busy_without_waiting() {
    let fixture = Fixture::new("concurrency");
    let entered = Arc::new(Barrier::new(2));
    let release = Arc::new(Barrier::new(2));
    let manager = Arc::new(fixture.manager(Arc::new(BlockingClock {
        entered: entered.clone(),
        release: release.clone(),
    })));
    let worker_manager = manager.clone();
    let worker = thread::spawn(move || worker_manager.create_manual());
    entered.wait();

    let error = manager.create_manual().unwrap_err();

    assert_eq!(error.code, "BACKUP_OPERATION_BUSY");
    release.wait();
    assert!(worker.join().unwrap().unwrap().created);
}

#[test]
fn cancel_removes_only_the_internal_preview_copy() {
    let fixture = Fixture::new("cancel");
    let manager = fixture.manager(Arc::new(FixedClock));
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let original = fs::read(&artifact).unwrap();

    let preview = manager.preview_restore(&artifact).unwrap();
    assert_eq!(files_in(&restore_root(&fixture.root)), 1);
    manager.discard_restore_preview(&preview.token).unwrap();

    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
    assert_eq!(fs::read(&artifact).unwrap(), original);
    assert_eq!(
        manager
            .discard_restore_preview(&preview.token)
            .unwrap_err()
            .code,
        "RESTORE_PREVIEW_UNAVAILABLE"
    );
}

#[cfg(unix)]
#[test]
fn control_character_source_basename_is_rejected_before_staging() {
    let fixture = Fixture::new("basename");
    let manager = fixture.manager(Arc::new(FixedClock));
    let backup = manager.create_manual().unwrap();
    let original = fixture.backups.join(backup.basename.unwrap());
    let unsafe_source = fixture.root.join("unsafe\nname.bodam-backup");
    fs::copy(original, &unsafe_source).unwrap();

    let error = manager.preview_restore(&unsafe_source).unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
}

#[test]
fn valid_archive_with_a_different_extension_is_rejected_before_staging() {
    let fixture = Fixture::new("extension");
    let manager = fixture.manager(Arc::new(FixedClock));
    let backup = manager.create_manual().unwrap();
    let original = fixture.backups.join(backup.basename.unwrap());
    let renamed = fixture.root.join("renamed.txt");
    fs::copy(original, &renamed).unwrap();

    let error = manager.preview_restore(&renamed).unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
}

#[test]
fn restore_confirmation_creates_a_fresh_private_default_for_pre_restore_backup() {
    let fixture = Fixture::new("fresh-default-restore");
    let external = fixture.root.join("external-backups");
    fs::create_dir(&external).unwrap();
    let external = fs::canonicalize(external).unwrap();
    let source_manager = BackupManager::with_dependencies(
        fixture.database.clone(),
        fixture.root.clone(),
        external.clone(),
        "0.1.0".into(),
        Arc::new(FixedClock),
        Arc::new(OsAtomicReplacer),
        Arc::new(OsRetentionRemover),
    );
    let source = source_manager.create_manual().unwrap();
    let artifact = external.join(source.basename.unwrap());
    let manager = fixture.manager(Arc::new(FixedClock));
    assert!(!fixture.backups.exists());

    let preview = manager.preview_restore(&artifact).unwrap();
    assert!(
        manager
            .confirm_restore(&preview.token)
            .unwrap()
            .restart_required
    );

    assert!(fixture.backups.is_dir());
    let pre_restore_count = fs::read_dir(&fixture.backups)
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| inspect_verified_archive(&entry.path()).ok())
        .filter(|archive| archive.manifest.reason == BackupReason::PreRestore)
        .count();
    assert_eq!(pre_restore_count, 1);
}

fn files_in(path: &Path) -> usize {
    fs::read_dir(path)
        .map(|entries| entries.count())
        .unwrap_or(0)
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    backups: PathBuf,
}

impl Fixture {
    fn new(marker: &str) -> Self {
        let root = std::env::temp_dir().join(format!("bodam-manager-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        let connection = database::open(&database).unwrap();
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES ('committed', ?1)",
                [format!("합성 {marker}")],
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

    fn manager(&self, clock: Arc<dyn BackupClock>) -> BackupManager {
        BackupManager::with_dependencies(
            self.database.clone(),
            self.root.clone(),
            self.backups.clone(),
            "0.1.0".into(),
            clock,
            Arc::new(OsAtomicReplacer),
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

struct BlockingClock {
    entered: Arc<Barrier>,
    release: Arc<Barrier>,
}

impl BackupClock for BlockingClock {
    fn now(&self) -> ClockReading {
        self.entered.wait();
        self.release.wait();
        fixed_reading()
    }
}

fn fixed_reading() -> ClockReading {
    ClockReading {
        utc: Utc.with_ymd_and_hms(2026, 8, 7, 1, 2, 3).unwrap(),
        local_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[path = "manager_capability_tests.rs"]
mod capability_tests;
