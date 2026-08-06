use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, TimeZone, Utc};
use uuid::Uuid;

use super::{
    archive_inspection_count, reset_archive_inspection_count, scan_verified_backups,
    OsRetentionRemover, RetentionRemover, AUTOMATIC_RETENTION_LIMIT,
};
use crate::backup::archive::{inspect_verified_archive, write_verified_archive};
use crate::backup::directory_capability::DirectoryCapability;
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::model::{BackupManifest, BackupReason, BACKUP_FORMAT_VERSION};
use crate::backup::snapshot::{create_online_snapshot, DatabaseDescriptor};
use crate::database;

#[test]
fn only_daily_and_exit_reasons_are_automatic() {
    assert!(BackupReason::Daily.is_automatic());
    assert!(BackupReason::Exit.is_automatic());
    assert!(!BackupReason::Manual.is_automatic());
    assert!(!BackupReason::PreRestore.is_automatic());
    assert_eq!(AUTOMATIC_RETENTION_LIMIT, 30);
}

#[test]
fn complete_archive_temporary_is_never_counted_by_retention() {
    let fixture = Fixture::new();
    let temporary = format!(".bodam-backup-{}.tmp.bodam-backup", Uuid::new_v4());
    fixture.write_reason(&temporary, BackupReason::Daily);
    reset_archive_inspection_count();

    let catalog = scan_verified_backups(&fixture.root).unwrap();

    assert_eq!(catalog.summarize().automatic_count, 0);
    assert_eq!(archive_inspection_count(), 0);
    assert!(fixture.root.join(temporary).is_file());
}

#[test]
fn retention_handles_29_30_31_and_preserves_exclusions_on_delete_failure() {
    let fixture = Fixture::new();
    fixture.create_automatic_copies(29);
    fixture.write_reason("manual.bodam-backup", BackupReason::Manual);
    fixture.write_reason("pre-restore.bodam-backup", BackupReason::PreRestore);
    assert_eq!(automatic_count(&fixture.root), 29);
    let mut catalog = scan_verified_backups(&fixture.root).unwrap();
    assert_eq!(
        catalog.enforce_automatic_retention(&OsRetentionRemover),
        Default::default()
    );

    fixture.create_automatic_copy(29);
    assert_eq!(automatic_count(&fixture.root), 30);
    let mut catalog = scan_verified_backups(&fixture.root).unwrap();
    assert_eq!(
        catalog.enforce_automatic_retention(&OsRetentionRemover),
        Default::default()
    );

    fixture.create_automatic_copy(30);
    let mut catalog = scan_verified_backups(&fixture.root).unwrap();
    let warning = catalog.enforce_automatic_retention(&FailingRemover);
    assert_eq!(warning.removed_count, 0);
    assert_eq!(warning.warning_count, 1);
    assert_eq!(automatic_count(&fixture.root), 31);
    assert!(fixture.root.join("auto-030.bodam-backup").is_file());
    assert!(fixture.root.join("manual.bodam-backup").is_file());
    assert!(fixture.root.join("pre-restore.bodam-backup").is_file());

    let removed = catalog.enforce_automatic_retention(&OsRetentionRemover);
    assert_eq!(removed.removed_count, 1);
    assert_eq!(removed.warning_count, 0);
    assert_eq!(automatic_count(&fixture.root), 30);
    assert!(fixture.root.join("auto-030.bodam-backup").is_file());
    assert!(fixture.root.join("manual.bodam-backup").is_file());
    assert!(fixture.root.join("pre-restore.bodam-backup").is_file());
}

#[test]
fn retention_sync_failure_keeps_the_newest_archive_and_reports_uncertain_deletion() {
    let fixture = Fixture::new();
    fixture.create_automatic_copies(31);
    let mut catalog = scan_verified_backups(&fixture.root).unwrap();

    let report = catalog.enforce_automatic_retention(&FailingSyncRemover);

    assert_eq!(report.removed_count, 0);
    assert_eq!(report.warning_count, 1);
    assert_eq!(catalog.summarize().automatic_count, 31);
    assert_eq!(automatic_count(&fixture.root), 30);
    assert!(fixture.root.join("auto-030.bodam-backup").is_file());
}

#[cfg(unix)]
#[test]
fn unreadable_directory_and_archive_fail_closed() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new();
    fixture.write_reason("daily.bodam-backup", BackupReason::Daily);
    let archive = fixture.root.join("daily.bodam-backup");

    fs::set_permissions(&archive, fs::Permissions::from_mode(0o000)).unwrap();
    let archive_error = scan_verified_backups(&fixture.root).unwrap_err();
    fs::set_permissions(&archive, fs::Permissions::from_mode(0o600)).unwrap();
    assert_eq!(archive_error.code, "BACKUP_PATH_UNAVAILABLE");

    fs::set_permissions(&fixture.root, fs::Permissions::from_mode(0o300)).unwrap();
    let directory_error = scan_verified_backups(&fixture.root).unwrap_err();
    fs::set_permissions(&fixture.root, fs::Permissions::from_mode(0o700)).unwrap();
    assert_eq!(directory_error.code, "BACKUP_PATH_UNAVAILABLE");
}

fn automatic_count(directory: &Path) -> usize {
    fs::read_dir(directory)
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| inspect_verified_archive(&entry.path()).ok())
        .filter(|entry| entry.manifest.reason.is_automatic())
        .count()
}

struct FailingRemover;

impl RetentionRemover for FailingRemover {
    fn remove(&self, _path: &Path) -> io::Result<()> {
        Err(io::Error::new(io::ErrorKind::PermissionDenied, "synthetic"))
    }
}

struct FailingSyncRemover;

impl RetentionRemover for FailingSyncRemover {
    fn remove(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn remove_in(&self, directory: &DirectoryCapability, basename: &str) -> io::Result<()> {
        OsRetentionRemover.remove_in(directory, basename)
    }

    fn sync_in(&self, _directory: &DirectoryCapability) -> io::Result<()> {
        Err(io::Error::other("synthetic retention sync failure"))
    }
}

struct Fixture {
    root: PathBuf,
    snapshot: PathBuf,
    descriptor: DatabaseDescriptor,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-retention-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database_path = root.join("source.sqlite3");
        drop(database::open(&database_path).unwrap());
        let snapshot = root.join("snapshot.sqlite3");
        let descriptor = create_online_snapshot(&database_path, &snapshot).unwrap();
        Self {
            root,
            snapshot,
            descriptor,
        }
    }

    fn create_automatic_copies(&self, count: usize) {
        self.write_reason("auto-000.bodam-backup", BackupReason::Daily);
        for index in 1..count {
            self.create_automatic_copy(index);
        }
    }

    fn create_automatic_copy(&self, index: usize) {
        fs::copy(
            self.root.join("auto-000.bodam-backup"),
            self.root.join(format!("auto-{index:03}.bodam-backup")),
        )
        .unwrap();
    }

    fn write_reason(&self, basename: &str, reason: BackupReason) {
        let manifest = manifest(&self.descriptor, reason);
        write_verified_archive(
            &self.root.join(basename),
            &self.snapshot,
            &manifest,
            &OsAtomicReplacer,
        )
        .unwrap();
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn manifest(descriptor: &DatabaseDescriptor, reason: BackupReason) -> BackupManifest {
    BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        created_at_utc: Utc
            .with_ymd_and_hms(2026, 8, 7, 1, 2, 3)
            .unwrap()
            .to_rfc3339_opts(SecondsFormat::Millis, true),
        local_date: "2026-08-07".into(),
        reason,
        app_version: "0.1.0".into(),
        schema_migration_count: descriptor.schema.migration_count,
        schema_last_migration: descriptor.schema.last_migration_name.clone(),
        database_size_bytes: descriptor.size_bytes,
        database_sha256: descriptor.sha256.clone(),
    }
}
