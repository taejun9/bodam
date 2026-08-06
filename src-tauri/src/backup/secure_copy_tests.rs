#![cfg(any(target_os = "macos", target_os = "linux"))]

use std::fs;
use std::os::unix::fs::symlink;
use std::path::PathBuf;

use uuid::Uuid;

use super::copy_secure_bounded_with_pre_open_hook;

#[test]
fn source_replaced_by_a_symlink_before_open_is_rejected() {
    let root = temporary("secure-copy-swap");
    fs::create_dir(&root).unwrap();
    let source = root.join("selected.bodam-backup");
    let original = root.join("original.bodam-backup");
    let foreign = root.join("foreign.bodam-backup");
    let destination = root.join("staged.bodam-backup");
    fs::write(&source, b"selected").unwrap();
    fs::write(&foreign, b"foreign").unwrap();

    let error = copy_secure_bounded_with_pre_open_hook(&source, &destination, 1024, || {
        fs::rename(&source, &original).unwrap();
        symlink(&foreign, &source).unwrap();
    })
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert!(!destination.exists());
    assert_eq!(fs::read(original).unwrap(), b"selected");
    assert_eq!(fs::read(foreign).unwrap(), b"foreign");
    fs::remove_dir_all(root).unwrap();
}

fn temporary(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-{label}-{}", Uuid::new_v4()))
}
