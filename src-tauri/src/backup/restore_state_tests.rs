use std::fs;
#[cfg(unix)]
use std::os::unix::fs::symlink;
use std::path::PathBuf;

use uuid::Uuid;

#[cfg(unix)]
use super::read_marker;
use super::{
    acknowledge_status, acknowledge_status_with_ops, pending_marker_path, read_status,
    restore_root, status_path, write_marker, write_status, PendingMarker, StatusAcknowledgeOps,
};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::model::{RestoreOutcome, StartupRestoreStatus};
use crate::backup::BackupError;

#[test]
fn status_read_is_non_destructive_and_acknowledgement_is_checked() {
    let root = temporary();
    fs::create_dir_all(&root).unwrap();
    let status = restored_status("BODAM-manual-safe.bodam-backup");
    write_status(&root, &status, &OsAtomicReplacer).unwrap();

    assert_eq!(read_status(&root).unwrap(), Some(status.clone()));
    assert_eq!(read_status(&root).unwrap(), Some(status.clone()));
    let different = restored_status("BODAM-manual-other.bodam-backup");
    assert!(acknowledge_status(&root, &different).is_err());
    assert_eq!(read_status(&root).unwrap(), Some(status.clone()));

    acknowledge_status(&root, &status).unwrap();
    assert_eq!(read_status(&root).unwrap(), None);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn durable_status_rejects_noncanonical_utc_timestamps() {
    let root = temporary();
    fs::create_dir_all(restore_root(&root)).unwrap();
    for timestamp in [
        "2026-08-07T01:02:03.004+00:00",
        "2026-08-07T01:02:03Z",
        "2026-08-07T01:02:03.04Z",
        "2026-08-07T01:02:03.0040Z",
    ] {
        let mut status = restored_status("BODAM-manual-safe.bodam-backup");
        status.completed_at_utc = timestamp.into();
        assert!(write_status(&root, &status, &OsAtomicReplacer).is_err());
        fs::write(status_path(&root), serde_json::to_vec(&status).unwrap()).unwrap();
        assert!(read_status(&root).is_err());
    }
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn pending_marker_accepts_only_exact_generated_restore_operands() {
    let root = temporary();
    fs::create_dir_all(restore_root(&root)).unwrap();
    let uuid = Uuid::new_v4();
    for (staged, safety) in [
        (
            "ordinary.bodam-backup".to_owned(),
            format!("restore-safety-{uuid}.sqlite3"),
        ),
        (
            format!("restore-preview-{uuid}.bodam-backup"),
            "ordinary.sqlite3".to_owned(),
        ),
    ] {
        let marker = PendingMarker::new(
            staged,
            safety,
            "BODAM-manual-safe.bodam-backup".into(),
            "a".repeat(64),
            "b".repeat(64),
        );
        assert!(write_marker(&root, &marker, &OsAtomicReplacer).is_err());
    }
    assert!(!pending_marker_path(&root).exists());
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn acknowledgement_io_failures_leave_the_durable_status_retryable() {
    for operations in [FailurePoint::Remove, FailurePoint::Sync] {
        let root = temporary();
        fs::create_dir_all(&root).unwrap();
        let status = restored_status("BODAM-manual-safe.bodam-backup");
        write_status(&root, &status, &OsAtomicReplacer).unwrap();

        assert!(acknowledge_status_with_ops(&root, &status, &operations).is_err());
        assert_eq!(read_status(&root).unwrap(), Some(status));
        fs::remove_dir_all(root).unwrap();
    }
}

#[cfg(unix)]
#[test]
fn dangling_state_links_are_errors_instead_of_missing_state() {
    let root = temporary();
    let state_root = restore_root(&root);
    fs::create_dir_all(&state_root).unwrap();
    let missing = state_root.join("missing-state.json");
    let marker = pending_marker_path(&root);
    symlink(&missing, &marker).unwrap();

    assert!(read_marker(&root).is_err());

    fs::remove_file(marker).unwrap();
    symlink(missing, status_path(&root)).unwrap();
    assert!(read_status(&root).is_err());
    fs::remove_dir_all(root).unwrap();
}

#[cfg(unix)]
#[test]
fn symlinked_restore_root_is_rejected_before_state_access() {
    let root = temporary();
    let external = temporary();
    fs::create_dir_all(&root).unwrap();
    fs::create_dir_all(&external).unwrap();
    symlink(&external, restore_root(&root)).unwrap();

    assert!(read_marker(&root).is_err());
    assert!(read_status(&root).is_err());
    fs::remove_dir_all(root).unwrap();
    fs::remove_dir_all(external).unwrap();
}

fn restored_status(backup_basename: &str) -> StartupRestoreStatus {
    StartupRestoreStatus {
        outcome: RestoreOutcome::Restored,
        backup_basename: backup_basename.into(),
        completed_at_utc: "2026-08-07T01:02:03.004Z".into(),
    }
}

enum FailurePoint {
    Remove,
    Sync,
}

impl StatusAcknowledgeOps for FailurePoint {
    fn remove_file(&self, path: &std::path::Path) -> Result<(), BackupError> {
        match self {
            Self::Remove => Err(BackupError::restore_failed()),
            Self::Sync => fs::remove_file(path).map_err(|_| BackupError::restore_failed()),
        }
    }

    fn sync_parent(&self, _path: &std::path::Path) -> Result<(), BackupError> {
        Err(BackupError::restore_failed())
    }
}

fn temporary() -> PathBuf {
    std::env::temp_dir().join(format!("bodam-state-read-{}", Uuid::new_v4()))
}
