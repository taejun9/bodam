#![cfg(windows)]

use std::fs;
use std::os::windows::fs::symlink_file;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use uuid::Uuid;

use super::{copy_secure_bounded, copy_secure_bounded_with_pre_open_hook};

#[test]
fn source_replaced_by_a_file_symlink_before_open_is_rejected() {
    let root = temporary("windows-source-swap");
    fs::create_dir(&root).unwrap();
    let source = root.join("selected.bodam-backup");
    let original = root.join("original.bodam-backup");
    let foreign = root.join("foreign.bodam-backup");
    let destination = root.join("staged.bodam-backup");
    fs::write(&source, b"selected").unwrap();
    fs::write(&foreign, b"foreign").unwrap();

    let error = copy_secure_bounded_with_pre_open_hook(&source, &destination, 1024, || {
        fs::rename(&source, &original).unwrap();
        symlink_file(&foreign, &source).unwrap();
    })
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert!(!destination.exists());
    assert_eq!(fs::read(original).unwrap(), b"selected");
    assert_eq!(fs::read(foreign).unwrap(), b"foreign");
    fs::remove_file(source).unwrap();
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn source_below_an_ancestor_junction_is_rejected() {
    let root = temporary("windows-source-ancestor");
    let actual = root.join("actual");
    let alias = root.join("alias");
    fs::create_dir_all(&actual).unwrap();
    let source = actual.join("selected.bodam-backup");
    fs::write(&source, b"selected").unwrap();
    create_junction(&alias, &actual);
    let destination = root.join("staged.bodam-backup");

    let error =
        copy_secure_bounded(&alias.join("selected.bodam-backup"), &destination, 1024).unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert!(!destination.exists());
    assert_eq!(fs::read(source).unwrap(), b"selected");
    fs::remove_dir(&alias).unwrap();
    fs::remove_dir_all(root).unwrap();
}

fn create_junction(link: &Path, target: &Path) {
    let status = Command::new("cmd.exe")
        .args(["/D", "/C", "mklink", "/J"])
        .arg(link)
        .arg(target)
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .status()
        .unwrap();
    assert!(status.success(), "junction creation failed");
}

fn temporary(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-{label}-{}", Uuid::new_v4()))
}
