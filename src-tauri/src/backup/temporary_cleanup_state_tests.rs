use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use uuid::Uuid;

use super::{sweep_startup_temporary_files, OsTemporaryCleanupOps, TemporaryCleanupOps};
use crate::database;

#[test]
fn startup_sweep_removes_exact_state_temporary_and_preserves_near_misses() {
    let fixture = Fixture::new("state-exact");
    let restore = fixture.restore_root();
    fs::create_dir(&restore).unwrap();
    let token = Uuid::new_v4();
    let uppercase_token = Uuid::new_v4();
    let exact = restore.join(format!(".bodam-state-{token}.tmp.json"));
    let near_misses = [
        restore.join(format!(".bodam-state-{token}.tmp.json.extra")),
        restore.join(format!(".bodam-state-{token}.tmp.tmp.json")),
        restore.join(format!(
            ".bodam-state-{}.tmp.json",
            uppercase_token.hyphenated().to_string().to_uppercase()
        )),
        restore.join(".bodam-state-00000000-0000-0000-0000-000000000000.tmp.json"),
    ];
    fs::write(&exact, b"interrupted state").unwrap();
    for path in &near_misses {
        fs::write(path, b"keep").unwrap();
    }

    fixture.sweep(&OsTemporaryCleanupOps).unwrap();

    assert!(!exact.exists());
    assert!(near_misses.iter().all(|path| path.is_file()));
}

#[test]
fn matching_state_directory_fails_closed() {
    let fixture = Fixture::new("state-directory");
    let restore = fixture.restore_root();
    fs::create_dir(&restore).unwrap();
    let matching = restore.join(state_name());
    fs::create_dir(&matching).unwrap();

    assert!(fixture.sweep(&OsTemporaryCleanupOps).is_err());
    assert!(matching.is_dir());
}

#[cfg(unix)]
#[test]
fn matching_state_symlink_never_deletes_its_target() {
    use std::os::unix::fs::symlink;

    let fixture = Fixture::new("state-symlink");
    let restore = fixture.restore_root();
    fs::create_dir(&restore).unwrap();
    let target = fixture.root.join("ordinary-user-state.json");
    fs::write(&target, b"keep").unwrap();
    let matching = restore.join(state_name());
    symlink(&target, &matching).unwrap();

    assert!(fixture.sweep(&OsTemporaryCleanupOps).is_err());
    assert!(matching.is_symlink());
    assert_eq!(fs::read(target).unwrap(), b"keep");
}

#[test]
fn state_delete_failure_is_reported_and_next_startup_retries() {
    let fixture = Fixture::new("state-delete-fault");
    let restore = fixture.restore_root();
    fs::create_dir(&restore).unwrap();
    let state = restore.join(state_name());
    fs::write(&state, b"interrupted state").unwrap();
    let operations = FaultCleanup::delete_once();

    assert!(fixture.sweep(&operations).is_err());
    assert!(state.is_file());
    fixture.sweep(&OsTemporaryCleanupOps).unwrap();
    assert!(!state.exists());
}

#[test]
fn state_directory_sync_failure_is_reported_and_retry_is_idempotent() {
    let fixture = Fixture::new("state-sync-fault");
    let restore = fixture.restore_root();
    fs::create_dir(&restore).unwrap();
    let state = restore.join(state_name());
    fs::write(&state, b"interrupted state").unwrap();
    let operations = FaultCleanup::sync_after_remove_once();

    assert!(fixture.sweep(&operations).is_err());
    assert!(!state.exists());
    fixture.sweep(&OsTemporaryCleanupOps).unwrap();
}

fn state_name() -> String {
    format!(".bodam-state-{}.tmp.json", Uuid::new_v4())
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
        let is_state = path
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.starts_with(".bodam-state-"));
        if is_state
            && matches!(self.mode, FaultMode::Delete)
            && self.armed.swap(false, Ordering::SeqCst)
        {
            return Err(io::Error::other("synthetic state delete failure"));
        }
        fs::remove_file(path)?;
        if is_state {
            self.removed.store(true, Ordering::SeqCst);
        }
        Ok(())
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        if matches!(self.mode, FaultMode::SyncAfterRemove)
            && self.removed.swap(false, Ordering::SeqCst)
            && self.armed.swap(false, Ordering::SeqCst)
        {
            Err(io::Error::other("synthetic state directory sync failure"))
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
        let root =
            std::env::temp_dir().join(format!("bodam-state-sweep-{label}-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        drop(database::open(&database).unwrap());
        Self { root, database }
    }

    fn restore_root(&self) -> PathBuf {
        self.root.join("restore")
    }

    fn sweep(
        &self,
        operations: &dyn TemporaryCleanupOps,
    ) -> Result<(), crate::backup::BackupError> {
        sweep_startup_temporary_files(&self.root, &self.database, operations)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
