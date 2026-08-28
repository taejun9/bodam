use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

#[cfg(unix)]
use std::os::unix::fs::PermissionsExt;

use chrono::{TimeZone, Utc};
use rusqlite::Connection;
use uuid::Uuid;

use super::archive::{
    extract_verified_archive, inspect_verified_archive, write_verified_archive, MAX_ARCHIVE_BYTES,
    MAX_DATABASE_BYTES,
};
use super::clock::{BackupClock, ClockReading};
use super::file_ops::OsAtomicReplacer;
use super::manager::BackupManager;
use super::model::{BackupManifest, BackupReason, RestoreOutcome, BACKUP_FORMAT_VERSION};
use super::restore::apply_pending_restore_with_replacer;
use super::restore_state::{acknowledge_status, read_status, restore_root};
use super::retention::OsRetentionRemover;
use super::snapshot::{create_online_snapshot, inspect_database, migrate_working_database};
use crate::database;

#[test]
fn online_snapshot_reads_a_committed_wal_boundary_and_excludes_uncommitted_rows() {
    let runtime = TestDirectory::new();
    let database_path = runtime.path().join("source.sqlite3");
    seed_current_database(&database_path, "committed");
    let writer = database::open(&database_path).unwrap();
    writer.execute_batch("BEGIN IMMEDIATE").unwrap();
    writer
        .execute(
            "INSERT INTO customers (id, name) VALUES ('uncommitted', '합성 미확정')",
            [],
        )
        .unwrap();

    let snapshot_path = runtime.path().join("snapshot.sqlite3");
    let descriptor = create_online_snapshot(&database_path, &snapshot_path).unwrap();
    assert_eq!(descriptor.schema, database::current_registered_version());
    let snapshot = Connection::open(&snapshot_path).unwrap();
    let ids = snapshot
        .prepare("SELECT id FROM customers ORDER BY id")
        .unwrap()
        .query_map([], |row| row.get::<_, String>(0))
        .unwrap()
        .collect::<Result<Vec<_>, _>>()
        .unwrap();
    assert_eq!(ids, vec!["committed"]);
    writer.execute_batch("ROLLBACK").unwrap();
}

#[test]
fn archive_round_trip_enforces_manifest_digest_and_exact_entries() {
    let runtime = TestDirectory::new();
    let database_path = runtime.path().join("source.sqlite3");
    seed_current_database(&database_path, "archive");
    let snapshot_path = runtime.path().join("snapshot.sqlite3");
    let descriptor = create_online_snapshot(&database_path, &snapshot_path).unwrap();
    let manifest = manifest(&descriptor, BackupReason::Manual, 0);
    let artifact = runtime.path().join("manual.bodam-backup");
    write_verified_archive(&artifact, &snapshot_path, &manifest, &OsAtomicReplacer).unwrap();
    let extracted = runtime.path().join("extracted.sqlite3");
    let validated = extract_verified_archive(&artifact, &extracted).unwrap();
    assert_eq!(validated.manifest, manifest);
    assert_eq!(validated.database, descriptor);

    let mut wrong = manifest;
    wrong.database_sha256 = "0".repeat(64);
    let rejected = runtime.path().join("rejected.bodam-backup");
    let error =
        write_verified_archive(&rejected, &snapshot_path, &wrong, &OsAtomicReplacer).unwrap_err();
    assert_eq!(error.code, "BACKUP_CHECKSUM_MISMATCH");
    assert!(!rejected.exists());
    assert!(wrong.validate(MAX_DATABASE_BYTES).is_ok());
}

#[test]
fn registered_v9_prefix_migrates_only_in_the_working_copy() {
    let runtime = TestDirectory::new();
    let old = runtime.path().join("old.sqlite3");
    database::create_registered_prefix_for_test(&old, 9).unwrap();
    let before = inspect_database(&old, false).unwrap();
    assert_eq!(before.schema.migration_count, 9);
    let migrated = migrate_working_database(&old).unwrap();
    assert_eq!(migrated.schema, database::current_registered_version());
    let connection = Connection::open(&old).unwrap();
    assert_eq!(
        connection
            .execute("UPDATE app_settings SET theme = 'system' WHERE id = 1", [])
            .unwrap(),
        1
    );
}

#[test]
fn manager_restores_through_a_durable_marker_and_waits_for_status_acknowledgement() {
    let runtime = TestDirectory::new();
    let database_path = runtime.path().join("bodam.sqlite3");
    let backup_directory = runtime.path().join("backups");
    seed_current_database(&database_path, "before");
    let manager = BackupManager::with_dependencies(
        database_path.clone(),
        runtime.path().to_owned(),
        backup_directory.clone(),
        "0.1.0".into(),
        Arc::new(FixedClock),
        Arc::new(OsAtomicReplacer),
        Arc::new(OsRetentionRemover),
    );
    let backup = manager.create_manual().unwrap();
    let artifact = backup_directory.join(backup.basename.unwrap());
    let connection = database::open(&database_path).unwrap();
    connection
        .execute(
            "UPDATE customers SET name = '합성 변경' WHERE id = 'committed'",
            [],
        )
        .unwrap();
    drop(connection);

    let preview = manager.preview_restore(&artifact).unwrap();
    let pending = manager.confirm_restore(&preview.token).unwrap();
    assert!(pending.restart_required);
    let status = apply_pending_restore_with_replacer(
        &database_path,
        runtime.path(),
        fixed_reading().utc,
        &OsAtomicReplacer,
    )
    .unwrap()
    .unwrap();
    assert_eq!(status.outcome, RestoreOutcome::Restored);
    let restored = Connection::open(&database_path).unwrap();
    let name: String = restored
        .query_row(
            "SELECT name FROM customers WHERE id = 'committed'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(name, "합성 before");
    drop(restored);
    assert_eq!(read_status(runtime.path()).unwrap(), Some(status.clone()));
    acknowledge_status(runtime.path(), &status).unwrap();
    let pre_restore = fs::read_dir(&backup_directory)
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| inspect_verified_archive(&entry.path()).ok())
        .filter(|archive| archive.manifest.reason == BackupReason::PreRestore)
        .count();
    assert_eq!(pre_restore, 1);
}

#[test]
fn manager_can_switch_from_a_custom_directory_to_a_fresh_private_default() {
    let runtime = TestDirectory::new();
    let database_path = runtime.path().join("bodam.sqlite3");
    let custom = runtime.path().join("custom-backups");
    fs::create_dir(&custom).unwrap();
    seed_current_database(&database_path, "directory-switch");
    let manager = BackupManager::with_dependencies(
        database_path,
        runtime.path().to_owned(),
        custom,
        "0.1.0".into(),
        Arc::new(FixedClock),
        Arc::new(OsAtomicReplacer),
        Arc::new(OsRetentionRemover),
    );
    let default_directory = runtime.path().join("backups");
    assert!(!default_directory.exists());

    manager
        .set_backup_directory(default_directory.clone())
        .unwrap();

    assert!(default_directory.is_dir());
    #[cfg(unix)]
    assert_eq!(
        fs::metadata(&default_directory)
            .unwrap()
            .permissions()
            .mode()
            & 0o777,
        0o700
    );
    assert!(manager.create_manual().unwrap().created);
}

#[test]
fn oversized_restore_source_is_rejected_before_staging_and_leaves_database_unchanged() {
    let runtime = TestDirectory::new();
    let database_path = runtime.path().join("bodam.sqlite3");
    let backup_directory = runtime.path().join("backups");
    seed_current_database(&database_path, "oversize-unchanged");
    let manager = BackupManager::with_dependencies(
        database_path.clone(),
        runtime.path().to_owned(),
        backup_directory,
        "0.1.0".into(),
        Arc::new(FixedClock),
        Arc::new(OsAtomicReplacer),
        Arc::new(OsRetentionRemover),
    );
    let oversized = runtime.path().join("oversized.bodam-backup");
    fs::File::create(&oversized)
        .unwrap()
        .set_len(MAX_ARCHIVE_BYTES + 1)
        .unwrap();

    let error = manager.preview_restore(&oversized).unwrap_err();

    assert_eq!(error.code, "BACKUP_ARCHIVE_TOO_LARGE");
    let root = restore_root(runtime.path());
    assert!(root.is_dir());
    assert_eq!(fs::read_dir(root).unwrap().count(), 0);
    let connection = Connection::open(&database_path).unwrap();
    let name: String = connection
        .query_row(
            "SELECT name FROM customers WHERE id = 'committed'",
            [],
            |row| row.get(0),
        )
        .unwrap();
    assert_eq!(name, "합성 oversize-unchanged");
}

fn seed_current_database(path: &Path, marker: &str) {
    let connection = database::open(path).unwrap();
    connection
        .execute(
            "INSERT INTO customers (id, name) VALUES ('committed', ?1)",
            [format!("합성 {marker}")],
        )
        .unwrap();
}

fn manifest(
    descriptor: &super::snapshot::DatabaseDescriptor,
    reason: BackupReason,
    second: u32,
) -> BackupManifest {
    BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        created_at_utc: Utc
            .with_ymd_and_hms(2026, 8, 7, 1, 2, second)
            .unwrap()
            .to_rfc3339_opts(chrono::SecondsFormat::Millis, true),
        local_date: "2026-08-07".into(),
        reason,
        app_version: "0.1.0".into(),
        schema_migration_count: descriptor.schema.migration_count,
        schema_last_migration: descriptor.schema.last_migration_name.clone(),
        database_size_bytes: descriptor.size_bytes,
        database_sha256: descriptor.sha256.clone(),
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

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-backup-test-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
