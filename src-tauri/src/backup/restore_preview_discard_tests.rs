use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use chrono::{TimeZone, Utc};
use uuid::Uuid;

use super::clock::{BackupClock, ClockReading};
use super::error::BackupError;
use super::file_ops::{sync_parent, OsAtomicReplacer};
use super::manager::BackupManager;
use super::restore_preview_discard::RestorePreviewRemover;
use super::restore_state::restore_root;
use super::retention::OsRetentionRemover;
use crate::database;

#[test]
fn injected_permission_denial_preserves_the_preview_for_retry() {
    let fixture = Fixture::new("remove-retry");
    let mut manager = fixture.manager();
    manager.preview_remover = Arc::new(FaultyRemover::remove_once());
    let artifact = manual_artifact(&fixture, &manager);
    let preview = manager.preview_restore(&artifact).unwrap();

    let error = manager.discard_restore_preview(&preview.token).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert_eq!(files_in(&restore_root(&fixture.root)), 1);
    assert_eq!(
        manager.preview_restore(&artifact).unwrap_err().code,
        "RESTORE_PREVIEW_UNAVAILABLE"
    );
    assert_eq!(files_in(&restore_root(&fixture.root)), 1);
    manager.discard_restore_preview(&preview.token).unwrap();
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
}

#[test]
fn parent_sync_failure_keeps_the_slot_until_an_idempotent_retry() {
    let fixture = Fixture::new("sync-retry");
    let mut manager = fixture.manager();
    manager.preview_remover = Arc::new(FaultyRemover::sync_once());
    let artifact = manual_artifact(&fixture, &manager);
    let preview = manager.preview_restore(&artifact).unwrap();

    let error = manager.discard_restore_preview(&preview.token).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    assert_eq!(files_in(&restore_root(&fixture.root)), 0);
    assert_eq!(
        manager.preview_restore(&artifact).unwrap_err().code,
        "RESTORE_PREVIEW_UNAVAILABLE"
    );
    manager.discard_restore_preview(&preview.token).unwrap();
    let next = manager.preview_restore(&artifact).unwrap();
    manager.discard_restore_preview(&next.token).unwrap();
}

#[test]
fn an_existing_preview_rejects_replacement_before_creating_a_file() {
    let fixture = Fixture::new("replace-rejected");
    let manager = fixture.manager();
    let artifact = manual_artifact(&fixture, &manager);
    let preview = manager.preview_restore(&artifact).unwrap();
    let root = restore_root(&fixture.root);
    let staged = only_file(&root);

    let error = manager.preview_restore(&artifact).unwrap_err();

    assert_eq!(error.code, "RESTORE_PREVIEW_UNAVAILABLE");
    assert_eq!(only_file(&root), staged);
    manager.discard_restore_preview(&preview.token).unwrap();
}

#[cfg(unix)]
#[test]
fn preview_staging_root_and_copy_are_private_to_the_current_account() {
    use std::os::unix::fs::PermissionsExt;

    let fixture = Fixture::new("private-preview");
    let manager = fixture.manager();
    let artifact = manual_artifact(&fixture, &manager);
    let preview = manager.preview_restore(&artifact).unwrap();
    let root = restore_root(&fixture.root);
    let staged = only_file(&root);

    assert_eq!(
        fs::metadata(&root).unwrap().permissions().mode() & 0o777,
        0o700
    );
    assert_eq!(
        fs::metadata(staged).unwrap().permissions().mode() & 0o777,
        0o600
    );
    manager.discard_restore_preview(&preview.token).unwrap();
}

fn manual_artifact(fixture: &Fixture, manager: &BackupManager) -> PathBuf {
    let backup = manager.create_manual().unwrap();
    fixture.backups.join(backup.basename.unwrap())
}

fn files_in(path: &Path) -> usize {
    fs::read_dir(path)
        .map(|entries| entries.count())
        .unwrap_or(0)
}

fn only_file(path: &Path) -> PathBuf {
    let files = fs::read_dir(path)
        .unwrap()
        .map(|entry| entry.unwrap().path())
        .collect::<Vec<_>>();
    assert_eq!(files.len(), 1);
    files.into_iter().next().unwrap()
}

struct FaultyRemover {
    fail_remove: AtomicBool,
    fail_sync: AtomicBool,
}

impl FaultyRemover {
    fn remove_once() -> Self {
        Self {
            fail_remove: AtomicBool::new(true),
            fail_sync: AtomicBool::new(false),
        }
    }

    fn sync_once() -> Self {
        Self {
            fail_remove: AtomicBool::new(false),
            fail_sync: AtomicBool::new(true),
        }
    }
}

impl RestorePreviewRemover for FaultyRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        if self.fail_remove.swap(false, Ordering::SeqCst) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "synthetic permission denial",
            ));
        }
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> Result<(), BackupError> {
        if self.fail_sync.swap(false, Ordering::SeqCst) {
            return Err(BackupError::restore_failed());
        }
        sync_parent(parent)
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    backups: PathBuf,
}

impl Fixture {
    fn new(marker: &str) -> Self {
        let root = std::env::temp_dir().join(format!("bodam-discard-{}", Uuid::new_v4()));
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
        ClockReading {
            utc: Utc.with_ymd_and_hms(2026, 8, 7, 1, 2, 3).unwrap(),
            local_date: chrono::NaiveDate::from_ymd_opt(2026, 8, 7).unwrap(),
        }
    }
}
