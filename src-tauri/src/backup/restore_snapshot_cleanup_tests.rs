use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::{TimeZone, Utc};
use uuid::Uuid;

use super::clock::{BackupClock, ClockReading};
use super::file_ops::OsAtomicReplacer;
use super::manager::BackupManager;
use super::restore::apply_pending_restore_with_replacer;
use super::restore_state::restore_root;
use super::retention::OsRetentionRemover;
use super::temporary_cleanup::workspace_root;
use crate::database;

#[test]
fn safety_snapshot_failure_leaves_only_the_retryable_preview() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let preview = manager.preview_restore(&artifact).unwrap();
    fs::write(&fixture.database, b"synthetic invalid sqlite").unwrap();

    let error = manager.confirm_restore(&preview.token).unwrap_err();

    assert!(matches!(
        error.code,
        "BACKUP_SCHEMA_INCOMPATIBLE" | "BACKUP_DATABASE_INVALID"
    ));
    let names = restore_names(&fixture.root);
    assert_eq!(names.len(), 1);
    assert!(names[0].starts_with("restore-preview-"));
    assert!(apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap()
    .is_none());
    assert!(restore_names(&fixture.root).is_empty());
}

#[test]
fn workspace_preparation_failure_never_creates_a_staged_preview() {
    let fixture = Fixture::new();
    let manager = fixture.manager();
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let unsafe_orphan =
        workspace_root(&fixture.root).join(format!(".bodam-inspect-{}.sqlite3", Uuid::new_v4()));
    fs::create_dir(&unsafe_orphan).unwrap();

    let error = manager.preview_restore(&artifact).unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(restore_names(&fixture.root).is_empty());
    assert!(unsafe_orphan.is_dir());
}

fn restore_names(app_data_dir: &Path) -> Vec<String> {
    fs::read_dir(restore_root(app_data_dir))
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .collect()
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    backups: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-safety-fault-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        drop(database::open(&database).unwrap());
        let backups = root.join("backups");
        Self {
            root,
            database,
            backups,
        }
    }

    fn manager(&self) -> BackupManager {
        BackupManager::with_dependencies(
            self.database.clone(),
            self.root.clone(),
            self.backups.clone(),
            "0.1.0".into(),
            Arc::new(FixedClock),
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

fn fixed_reading() -> ClockReading {
    ClockReading {
        utc: Utc.with_ymd_and_hms(2026, 8, 7, 1, 2, 3).unwrap(),
        local_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
    }
}
