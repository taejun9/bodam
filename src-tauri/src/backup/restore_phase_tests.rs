use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::{TimeZone, Utc};
use rusqlite::Connection;
use uuid::Uuid;

use super::clock::{BackupClock, ClockReading};
use super::file_ops::OsAtomicReplacer;
use super::manager::BackupManager;
use super::model::RestoreOutcome;
use super::restore::apply_pending_restore_with_replacer;
use super::restore_state::{acknowledge_status, pending_marker_path, read_status, restore_root};
use super::retention::OsRetentionRemover;
use crate::database;

#[test]
fn invalid_or_missing_safety_preserves_a_strictly_valid_current_database() {
    for damage in [SafetyDamage::Missing, SafetyDamage::Corrupt] {
        let fixture = Fixture::new();
        stage_restore(&fixture);
        damage.apply(&safety_path(&fixture.root));
        let before = fs::read(&fixture.database).unwrap();

        let status = apply_pending_restore_with_replacer(
            &fixture.database,
            &fixture.root,
            fixed_reading().utc,
            &OsAtomicReplacer,
        )
        .unwrap()
        .unwrap();

        assert_eq!(status.outcome, RestoreOutcome::RolledBack);
        assert_eq!(fs::read(&fixture.database).unwrap(), before);
        assert_eq!(customer_name(&fixture.database), "synthetic after");
        acknowledge_status(&fixture.root, &status).unwrap();
        assert_eq!(
            fs::read_dir(restore_root(&fixture.root)).unwrap().count(),
            0
        );
    }
}

#[test]
fn preinstall_failure_recovers_an_invalid_current_database_from_verified_safety() {
    let fixture = Fixture::new();
    stage_restore(&fixture);
    fs::write(staged_path(&fixture.root), b"synthetic invalid archive").unwrap();
    Connection::open(&fixture.database)
        .unwrap()
        .execute("DROP TABLE customers", [])
        .unwrap();

    let status = apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap()
    .unwrap();

    assert_eq!(status.outcome, RestoreOutcome::RolledBack);
    assert_eq!(customer_name(&fixture.database), "synthetic after");
    acknowledge_status(&fixture.root, &status).unwrap();
    assert_eq!(
        fs::read_dir(restore_root(&fixture.root)).unwrap().count(),
        0
    );
}

#[test]
fn invalid_current_and_checksum_mismatched_safety_are_fail_closed() {
    let fixture = Fixture::new();
    stage_restore(&fixture);
    let safety = safety_path(&fixture.root);
    database::open(&safety)
        .unwrap()
        .execute(
            "UPDATE customers SET name = 'synthetic tampered safety' WHERE id = 'committed'",
            [],
        )
        .unwrap();
    Connection::open(&fixture.database)
        .unwrap()
        .execute("DROP TABLE customers", [])
        .unwrap();

    let error = apply_pending_restore_with_replacer(
        &fixture.database,
        &fixture.root,
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_SCHEMA_INCOMPATIBLE");
    assert!(pending_marker_path(&fixture.root).is_file());
    assert_eq!(read_status(&fixture.root).unwrap(), None);
}

fn stage_restore(fixture: &Fixture) {
    let manager = fixture.manager();
    let backup = manager.create_manual().unwrap();
    let artifact = fixture.backups.join(backup.basename.unwrap());
    let connection = database::open(&fixture.database).unwrap();
    connection
        .execute(
            "UPDATE customers SET name = 'synthetic after' WHERE id = 'committed'",
            [],
        )
        .unwrap();
    drop(connection);
    let preview = manager.preview_restore(&artifact).unwrap();
    manager.confirm_restore(&preview.token).unwrap();
}

fn safety_path(app_data_dir: &Path) -> PathBuf {
    restore_operand(app_data_dir, "restore-safety-")
}

fn staged_path(app_data_dir: &Path) -> PathBuf {
    restore_operand(app_data_dir, "restore-preview-")
}

fn restore_operand(app_data_dir: &Path, prefix: &str) -> PathBuf {
    fs::read_dir(restore_root(app_data_dir))
        .unwrap()
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .find(|path| {
            path.file_name()
                .and_then(|name| name.to_str())
                .is_some_and(|name| name.starts_with(prefix))
        })
        .unwrap()
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

#[derive(Clone, Copy)]
enum SafetyDamage {
    Missing,
    Corrupt,
}

impl SafetyDamage {
    fn apply(self, path: &Path) {
        match self {
            Self::Missing => fs::remove_file(path).unwrap(),
            Self::Corrupt => fs::write(path, b"synthetic invalid safety").unwrap(),
        }
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    backups: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-restore-phase-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        let connection = database::open(&database).unwrap();
        connection
            .execute(
                "INSERT INTO customers (id, name) VALUES ('committed', 'synthetic before')",
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
