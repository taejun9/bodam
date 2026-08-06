use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, AtomicUsize, Ordering};

use uuid::Uuid;

use super::{
    cleanup_preview, cleanup_safety, sweep_orphaned_restore_files, OsRestoreRemover, RestoreRemover,
};
use crate::backup::restore_state::restore_root;

#[test]
fn safety_delete_failure_keeps_residue_for_startup_retry() {
    let fixture = Fixture::new();
    let safety = fixture.generated("restore-safety-", ".sqlite3");
    let wal = sidecar(&safety, "-wal");
    fs::write(&safety, b"synthetic database").unwrap();
    fs::write(&wal, b"synthetic wal").unwrap();
    let remover = FailTargetRemover(wal.clone());

    let error = cleanup_safety(&fixture.root, &safety, &remover).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert!(wal.exists());
    sweep_orphaned_restore_files(&fixture.root, &fixture.database, &OsRestoreRemover).unwrap();
    assert!(!wal.exists());
}

#[test]
fn preview_sync_failure_is_an_error_and_startup_retry_is_idempotent() {
    let fixture = Fixture::new();
    let preview = fixture.generated("restore-preview-", ".bodam-backup");
    fs::write(&preview, b"synthetic archive").unwrap();
    let remover = FailFirstSyncRemover(AtomicBool::new(true));

    let error = cleanup_preview(&fixture.root, &preview, &remover).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert!(!preview.exists());
    sweep_orphaned_restore_files(&fixture.root, &fixture.database, &OsRestoreRemover).unwrap();
}

#[test]
fn missing_snapshot_residue_still_requires_parent_sync() {
    let fixture = Fixture::new();
    let safety = fixture.generated("restore-safety-", ".sqlite3");
    let remover = CountingSyncRemover(AtomicUsize::new(0));

    cleanup_safety(&fixture.root, &safety, &remover).unwrap();

    assert_eq!(remover.0.load(Ordering::SeqCst), 1);
}

#[test]
fn cleanup_helpers_never_remove_arbitrary_restore_root_files() {
    let fixture = Fixture::new();
    let ordinary = restore_root(&fixture.root).join("ordinary.bodam-backup");
    fs::write(&ordinary, b"keep").unwrap();

    assert!(cleanup_preview(&fixture.root, &ordinary, &OsRestoreRemover).is_err());
    assert_eq!(fs::read(ordinary).unwrap(), b"keep");
}

struct FailTargetRemover(PathBuf);

impl RestoreRemover for FailTargetRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        if path == self.0 {
            Err(io::Error::other("synthetic delete failure"))
        } else {
            fs::remove_file(path)
        }
    }
}

struct FailFirstSyncRemover(AtomicBool);

impl RestoreRemover for FailFirstSyncRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        if self.0.swap(false, Ordering::SeqCst) {
            Err(io::Error::other("synthetic sync failure"))
        } else {
            Ok(())
        }
    }
}

struct CountingSyncRemover(AtomicUsize);

impl RestoreRemover for CountingSyncRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        self.0.fetch_add(1, Ordering::SeqCst);
        Ok(())
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-cleanup-fault-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        fs::create_dir(restore_root(&root)).unwrap();
        let database = root.join("bodam.sqlite3");
        fs::write(&database, b"synthetic current database").unwrap();
        Self { root, database }
    }

    fn generated(&self, prefix: &str, suffix: &str) -> PathBuf {
        restore_root(&self.root).join(format!("{prefix}{}{suffix}", Uuid::new_v4()))
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    let mut value = path.as_os_str().to_owned();
    value.push(suffix);
    PathBuf::from(value)
}
