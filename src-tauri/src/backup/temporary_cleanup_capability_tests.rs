use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use uuid::Uuid;

use super::sweep_backup_directory_in;
use crate::backup::directory_capability::DirectoryCapability;
use crate::backup::temporary_cleanup::{OsTemporaryCleanupOps, TemporaryCleanupOps};

#[test]
fn capability_sweep_removes_both_exact_probe_variants_only() {
    let fixture = Fixture::new("exact");
    let token = Uuid::new_v4();
    let uppercase_token = Uuid::new_v4();
    let exact = [
        format!(".bodam-write-check-{token}.tmp"),
        format!(".bodam-write-check-{token}.tmp.tmp"),
    ];
    let near_misses = [
        format!(".bodam-write-check-{token}.tmp.extra"),
        format!(".bodam-write-check-{token}.tmp.tmp.extra"),
        format!(
            ".bodam-write-check-{}.tmp",
            uppercase_token.hyphenated().to_string().to_uppercase()
        ),
        ".bodam-write-check-00000000-0000-0000-0000-000000000000.tmp".to_owned(),
    ];
    for name in exact.iter().chain(near_misses.iter()) {
        fs::write(fixture.root.join(name), b"synthetic probe").unwrap();
    }

    sweep_backup_directory_in(&fixture.capability, &OsTemporaryCleanupOps).unwrap();

    assert!(exact.iter().all(|name| !fixture.root.join(name).exists()));
    assert!(near_misses
        .iter()
        .all(|name| fixture.root.join(name).is_file()));
}

#[cfg(unix)]
#[test]
fn matching_probe_symlink_fails_closed_without_touching_target() {
    use std::os::unix::fs::symlink;

    let fixture = Fixture::new("symlink");
    let target = fixture.root.join("ordinary-user-file");
    fs::write(&target, b"keep").unwrap();
    let probe = format!(".bodam-write-check-{}.tmp", Uuid::new_v4());
    symlink(&target, fixture.root.join(&probe)).unwrap();

    assert!(sweep_backup_directory_in(&fixture.capability, &OsTemporaryCleanupOps).is_err());
    assert!(fixture.root.join(probe).is_symlink());
    assert_eq!(fs::read(target).unwrap(), b"keep");
}

#[test]
fn probe_delete_failure_is_reported_and_retry_removes_the_orphan() {
    let fixture = Fixture::new("delete-fault");
    let probe = format!(".bodam-write-check-{}.tmp", Uuid::new_v4());
    fs::write(fixture.root.join(&probe), b"synthetic probe").unwrap();
    let operations = FaultCleanup::delete_once();

    assert!(sweep_backup_directory_in(&fixture.capability, &operations).is_err());
    assert!(fixture.root.join(&probe).is_file());
    sweep_backup_directory_in(&fixture.capability, &OsTemporaryCleanupOps).unwrap();
    assert!(!fixture.root.join(probe).exists());
}

#[test]
fn probe_sync_failure_is_reported_after_removal_and_retry_is_idempotent() {
    let fixture = Fixture::new("sync-fault");
    let probe = format!(".bodam-write-check-{}.tmp.tmp", Uuid::new_v4());
    fs::write(fixture.root.join(&probe), b"synthetic probe").unwrap();
    let operations = FaultCleanup::sync_after_remove_once();

    assert!(sweep_backup_directory_in(&fixture.capability, &operations).is_err());
    assert!(!fixture.root.join(&probe).exists());
    sweep_backup_directory_in(&fixture.capability, &OsTemporaryCleanupOps).unwrap();
}

enum FaultMode {
    Delete,
    SyncAfterRemove,
}

struct FaultCleanup {
    mode: FaultMode,
    armed: AtomicBool,
    removed: AtomicBool,
}

impl FaultCleanup {
    fn delete_once() -> Self {
        Self::new(FaultMode::Delete)
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
        fs::remove_file(path)
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        Ok(())
    }

    fn remove_in(&self, directory: &DirectoryCapability, name: &str) -> io::Result<()> {
        if matches!(self.mode, FaultMode::Delete) && self.armed.swap(false, Ordering::SeqCst) {
            return Err(io::Error::other("synthetic capability delete failure"));
        }
        directory.remove_regular(name)?;
        self.removed.store(true, Ordering::SeqCst);
        Ok(())
    }

    fn sync_directory(&self, directory: &DirectoryCapability) -> io::Result<()> {
        if matches!(self.mode, FaultMode::SyncAfterRemove)
            && self.removed.swap(false, Ordering::SeqCst)
            && self.armed.swap(false, Ordering::SeqCst)
        {
            Err(io::Error::other("synthetic capability sync failure"))
        } else {
            directory.sync()
        }
    }
}

struct Fixture {
    root: PathBuf,
    capability: DirectoryCapability,
}

impl Fixture {
    fn new(label: &str) -> Self {
        let root =
            std::env::temp_dir().join(format!("bodam-probe-sweep-{label}-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let root = fs::canonicalize(root).unwrap();
        let capability = DirectoryCapability::acquire(&root, true).unwrap();
        Self { root, capability }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
