use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};

use uuid::Uuid;

use super::{
    cleanup_completed_restore, sweep_orphaned_restore_files, sweep_orphaned_restore_files_except,
    OsRestoreRemover, RestoreRemover,
};
use crate::backup::restore_state::restore_root;

#[test]
fn marker_delete_failure_preserves_every_restore_operand() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let marker = root.join("pending-restore.json");
    let staged = root.join(generated("restore-preview-", ".bodam-backup"));
    let safety = root.join(generated("restore-safety-", ".sqlite3"));
    let working = root.join(generated("restore-working-", ".sqlite3"));
    let replacement = fixture.root.join(generated(".bodam-restore-", ".sqlite3"));
    for path in [&marker, &staged, &safety, &working, &replacement] {
        fs::write(path, b"synthetic").unwrap();
    }
    let remover = FailTargetRemover {
        target: marker.clone(),
    };

    let error =
        cleanup_completed_restore(&marker, &staged, &safety, &working, &replacement, &remover)
            .unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    for path in [marker, staged, safety, working, replacement] {
        assert!(path.exists(), "{}", path.display());
    }
}

#[test]
fn markerless_sweep_surfaces_delete_failure_and_retries_cleanly() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let preview = root.join(generated("restore-preview-", ".bodam-backup"));
    fs::write(&preview, b"synthetic").unwrap();
    let remover = FailTargetRemover {
        target: preview.clone(),
    };

    let error =
        sweep_orphaned_restore_files(&fixture.root, &fixture.database, &remover).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert!(preview.exists());
    sweep_orphaned_restore_files(&fixture.root, &fixture.database, &OsRestoreRemover).unwrap();
    assert!(!preview.exists());
}

#[test]
fn markerless_sweep_surfaces_sync_failure_and_retry_is_idempotent() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let working = root.join(generated("restore-working-", ".sqlite3"));
    fs::write(&working, b"synthetic").unwrap();
    let remover = FailFirstSyncRemover(AtomicBool::new(true));

    let error =
        sweep_orphaned_restore_files(&fixture.root, &fixture.database, &remover).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert!(!working.exists());
    sweep_orphaned_restore_files(&fixture.root, &fixture.database, &remover).unwrap();
}

#[test]
fn markerless_sweep_removes_only_exact_app_owned_names() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let owned = [
        root.join(generated("restore-preview-", ".bodam-backup")),
        root.join(generated("restore-safety-", ".sqlite3")),
        root.join(generated("restore-working-", ".sqlite3")),
        fixture.root.join(generated(".bodam-restore-", ".sqlite3")),
        fixture.root.join(generated(".bodam-rollback-", ".sqlite3")),
    ];
    for path in &owned {
        fs::write(path, b"synthetic").unwrap();
        if path.extension().and_then(|value| value.to_str()) == Some("sqlite3") {
            for suffix in ["-wal", "-shm", "-journal"] {
                fs::write(sidecar(path, suffix), b"synthetic sidecar").unwrap();
            }
        }
    }
    let unrelated = root.join("restore-preview-not-a-uuid.bodam-backup");
    fs::write(&unrelated, b"keep").unwrap();
    let unrelated_sidecar = root.join(format!(
        "restore-working-{}.sqlite3-wal-extra",
        Uuid::new_v4()
    ));
    fs::write(&unrelated_sidecar, b"keep").unwrap();

    sweep_orphaned_restore_files(&fixture.root, &fixture.database, &OsRestoreRemover).unwrap();

    assert!(owned.iter().all(|path| !path.exists()));
    assert!(owned.iter().all(|path| ["-wal", "-shm", "-journal"]
        .iter()
        .all(|suffix| !sidecar(path, suffix).exists())));
    assert!(unrelated.exists());
    assert!(unrelated_sidecar.exists());
}

#[test]
fn pending_restore_sweep_preserves_only_referenced_operands() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let staged = root.join(generated("restore-preview-", ".bodam-backup"));
    let safety = root.join(generated("restore-safety-", ".sqlite3"));
    let old_working = root.join(generated("restore-working-", ".sqlite3"));
    for path in [&staged, &safety, &old_working] {
        fs::write(path, b"synthetic").unwrap();
    }
    fs::write(sidecar(&safety, "-wal"), b"preserve").unwrap();
    fs::write(sidecar(&old_working, "-wal"), b"remove").unwrap();

    sweep_orphaned_restore_files_except(
        &fixture.root,
        &fixture.database,
        &[&staged, &safety],
        &OsRestoreRemover,
    )
    .unwrap();

    assert!(staged.exists());
    assert!(safety.exists());
    assert!(sidecar(&safety, "-wal").exists());
    assert!(!old_working.exists());
    assert!(!sidecar(&old_working, "-wal").exists());
}

#[test]
fn markerless_sweep_rejects_matching_non_file_operand() {
    let fixture = Fixture::new();
    let root = restore_root(&fixture.root);
    fs::create_dir(&root).unwrap();
    let directory = root.join(generated("restore-working-", ".sqlite3"));
    fs::create_dir(&directory).unwrap();

    assert!(
        sweep_orphaned_restore_files(&fixture.root, &fixture.database, &OsRestoreRemover).is_err()
    );
    assert!(directory.is_dir());
}

fn generated(prefix: &str, suffix: &str) -> String {
    format!("{prefix}{}{suffix}", Uuid::new_v4())
}

fn sidecar(path: &Path, suffix: &str) -> PathBuf {
    PathBuf::from(format!("{}{suffix}", path.display()))
}

struct FailTargetRemover {
    target: PathBuf,
}

impl RestoreRemover for FailTargetRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        if path == self.target {
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

struct Fixture {
    root: PathBuf,
    database: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-cleanup-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        fs::write(&database, b"synthetic").unwrap();
        Self { root, database }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
