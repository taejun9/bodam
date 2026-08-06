use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::{TimeZone, Utc};
use uuid::Uuid;

use super::{
    sweep_startup_temporary_files, workspace_root, OsTemporaryCleanupOps, TemporaryCleanupOps,
};
use crate::backup::clock::{BackupClock, ClockReading};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::manager::BackupManager;
use crate::backup::retention::OsRetentionRemover;
use crate::database;

#[test]
fn startup_sweep_removes_exact_abort_orphans_and_sidecars_only() {
    let fixture = Fixture::new("startup");
    let workspace = workspace_root(&fixture.root);
    let backups = fixture.root.join("backups");
    fs::create_dir(&workspace).unwrap();
    fs::create_dir(&backups).unwrap();
    let snapshot = workspace.join(sqlite_name(".bodam-snapshot-"));
    let verify = workspace.join(sqlite_name(".bodam-verify-"));
    let inspect = workspace.join(sqlite_name(".bodam-inspect-"));
    let restore = fixture.root.join(sqlite_name(".bodam-restore-"));
    let rollback = fixture.root.join(sqlite_name(".bodam-rollback-"));
    let archive = backups.join(format!(".bodam-backup-{}.tmp.bodam-backup", Uuid::new_v4()));
    let probes = [
        backups.join(format!(".bodam-write-check-{}.tmp", Uuid::new_v4())),
        backups.join(format!(".bodam-write-check-{}.tmp.tmp", Uuid::new_v4())),
    ];
    for path in [&snapshot, &verify, &inspect, &restore, &rollback] {
        write_sqlite_family(path);
    }
    fs::write(&archive, b"synthetic archive").unwrap();
    for probe in &probes {
        fs::write(probe, b"synthetic interrupted write probe").unwrap();
    }
    let normal = backups.join("BODAM-manual-keep.bodam-backup");
    let near = workspace.join(format!(
        ".bodam-snapshot-{}.sqlite3-wal-extra",
        Uuid::new_v4()
    ));
    fs::write(&normal, b"keep").unwrap();
    fs::write(&near, b"keep").unwrap();

    sweep_startup_temporary_files(&fixture.root, &fixture.database, &OsTemporaryCleanupOps)
        .unwrap();

    for path in [&snapshot, &verify, &inspect, &restore, &rollback] {
        assert_sqlite_family_absent(path);
    }
    assert!(!archive.exists());
    assert!(probes.iter().all(|probe| !probe.exists()));
    assert!(normal.exists());
    assert!(near.exists());
}

#[test]
fn matching_nonregular_orphan_fails_closed() {
    let fixture = Fixture::new("nonregular");
    let workspace = workspace_root(&fixture.root);
    fs::create_dir(&workspace).unwrap();
    let matching = workspace.join(sqlite_name(".bodam-inspect-"));
    fs::create_dir(&matching).unwrap();
    let unrelated = workspace.join("notes.sqlite3");
    fs::write(&unrelated, b"keep").unwrap();

    let error =
        sweep_startup_temporary_files(&fixture.root, &fixture.database, &OsTemporaryCleanupOps)
            .unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(matching.is_dir());
    assert!(unrelated.is_file());
}

#[cfg(unix)]
#[test]
fn matching_symlink_never_deletes_its_target() {
    use std::os::unix::fs::symlink;

    let fixture = Fixture::new("symlink");
    let workspace = workspace_root(&fixture.root);
    fs::create_dir(&workspace).unwrap();
    let target = fixture.root.join("ordinary-user-file.sqlite3");
    fs::write(&target, b"keep").unwrap();
    let matching = workspace.join(sqlite_name(".bodam-verify-"));
    symlink(&target, &matching).unwrap();

    assert!(sweep_startup_temporary_files(
        &fixture.root,
        &fixture.database,
        &OsTemporaryCleanupOps,
    )
    .is_err());
    assert!(matching.is_symlink());
    assert_eq!(fs::read(target).unwrap(), b"keep");
}

#[test]
fn snapshot_delete_failure_is_reported_and_next_operation_retries() {
    let fixture = Fixture::new("delete-fault");
    let cleanup = Arc::new(FaultCleanup::delete_snapshot_once());
    let manager = fixture.manager(cleanup);

    let error = manager.create_manual().unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(workspace_contains(&fixture.root, ".bodam-snapshot-"));
    assert!(manager.create_manual().unwrap().created);
    assert!(!workspace_contains(&fixture.root, ".bodam-"));
}

#[test]
fn cleanup_sync_failure_is_reported_and_retry_succeeds() {
    let fixture = Fixture::new("sync-fault");
    let cleanup = Arc::new(FaultCleanup::sync_after_remove_once());
    let manager = fixture.manager(cleanup);

    let error = manager.create_manual().unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(manager.create_manual().unwrap().created);
    assert!(!workspace_contains(&fixture.root, ".bodam-"));
}

fn sqlite_name(prefix: &str) -> String {
    format!("{prefix}{}.sqlite3", Uuid::new_v4())
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut value = path.as_os_str().to_owned();
    value.push(suffix);
    PathBuf::from(value)
}

fn write_sqlite_family(path: &Path) {
    fs::write(path, b"synthetic database").unwrap();
    for suffix in ["-wal", "-shm", "-journal"] {
        fs::write(sidecar(path, suffix), b"synthetic sidecar").unwrap();
    }
}

fn assert_sqlite_family_absent(path: &Path) {
    assert!(!path.exists());
    for suffix in ["-wal", "-shm", "-journal"] {
        assert!(!sidecar(path, suffix).exists());
    }
}

fn workspace_contains(app_data: &Path, prefix: &str) -> bool {
    fs::read_dir(workspace_root(app_data))
        .unwrap()
        .filter_map(Result::ok)
        .any(|entry| entry.file_name().to_string_lossy().starts_with(prefix))
}

enum FaultMode {
    DeleteSnapshot,
    SyncAfterRemove,
}

struct FaultCleanup {
    mode: FaultMode,
    armed: AtomicBool,
    removed: AtomicBool,
}

impl FaultCleanup {
    fn delete_snapshot_once() -> Self {
        Self::new(FaultMode::DeleteSnapshot)
    }

    fn sync_after_remove_once() -> Self {
        Self::new(FaultMode::SyncAfterRemove)
    }

    fn new(mode: FaultMode) -> Self {
        Self {
            mode,
            armed: AtomicBool::new(true),
            removed: AtomicBool::new(false),
        }
    }
}

impl TemporaryCleanupOps for FaultCleanup {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        let snapshot = path
            .file_name()
            .and_then(|value| value.to_str())
            .is_some_and(|name| name.starts_with(".bodam-snapshot-"));
        if matches!(self.mode, FaultMode::DeleteSnapshot)
            && snapshot
            && self.armed.swap(false, Ordering::SeqCst)
        {
            return Err(io::Error::other("synthetic delete failure"));
        }
        fs::remove_file(path)?;
        self.removed.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        if matches!(self.mode, FaultMode::SyncAfterRemove)
            && self.removed.swap(false, Ordering::SeqCst)
            && self.armed.swap(false, Ordering::SeqCst)
        {
            Err(io::Error::other("synthetic sync failure"))
        } else {
            Ok(())
        }
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
}

impl Fixture {
    fn new(label: &str) -> Self {
        let root = std::env::temp_dir().join(format!("bodam-temp-{label}-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        drop(database::open(&database).unwrap());
        Self { root, database }
    }

    fn manager(&self, cleanup: Arc<dyn TemporaryCleanupOps>) -> BackupManager {
        BackupManager::with_cleanup_dependencies(
            self.database.clone(),
            self.root.clone(),
            self.root.join("backups"),
            "0.1.0".into(),
            Arc::new(FixedClock),
            Arc::new(OsAtomicReplacer),
            Arc::new(OsRetentionRemover),
            cleanup,
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
        ClockReading {
            utc: Utc.with_ymd_and_hms(2026, 8, 7, 1, 2, 3).unwrap(),
            local_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
        }
    }
}
