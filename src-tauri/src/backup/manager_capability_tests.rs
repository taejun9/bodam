use std::fs;
use std::os::unix::fs::symlink;
use std::sync::Arc;

use super::{FixedClock, Fixture};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::manager::BackupManager;
use crate::backup::retention::OsRetentionRemover;

#[test]
fn retargeted_custom_directory_ancestor_fails_before_initial_backup_write() {
    let fixture = Fixture::new("retarget-initial");
    let (manager, selected_parent, replacement, root) = custom_manager(&fixture);
    fs::rename(&selected_parent, root.join("original-parent")).unwrap();
    symlink(&replacement, &selected_parent).unwrap();

    let error = manager.create_manual().unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert_eq!(
        fs::read_dir(replacement.join("backups")).unwrap().count(),
        0
    );
}

#[test]
fn cached_directory_retarget_is_reported_without_writing_a_new_artifact() {
    let fixture = Fixture::new("retarget-cached");
    let (manager, selected_parent, replacement, root) = custom_manager(&fixture);
    assert!(manager.create_manual().unwrap().created);
    let original_parent = root.join("original-parent");
    fs::rename(&selected_parent, &original_parent).unwrap();
    symlink(&replacement, &selected_parent).unwrap();

    let error = manager.create_manual().unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert_eq!(
        fs::read_dir(original_parent.join("backups"))
            .unwrap()
            .count(),
        1
    );
    assert_eq!(
        fs::read_dir(replacement.join("backups")).unwrap().count(),
        0
    );
}

fn custom_manager(
    fixture: &Fixture,
) -> (
    BackupManager,
    std::path::PathBuf,
    std::path::PathBuf,
    std::path::PathBuf,
) {
    let root = fs::canonicalize(&fixture.root).unwrap();
    let selected_parent = root.join("selected-parent");
    let selected = selected_parent.join("backups");
    let replacement = root.join("replacement");
    fs::create_dir_all(&selected).unwrap();
    fs::create_dir_all(replacement.join("backups")).unwrap();
    let manager = BackupManager::with_dependencies(
        fixture.database.clone(),
        fixture.root.clone(),
        fs::canonicalize(selected).unwrap(),
        "0.1.0".into(),
        Arc::new(FixedClock),
        Arc::new(OsAtomicReplacer),
        Arc::new(OsRetentionRemover),
    );
    (manager, selected_parent, replacement, root)
}
