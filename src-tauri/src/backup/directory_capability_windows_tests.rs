#![cfg(windows)]

use std::collections::BTreeSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};

use uuid::Uuid;

use super::{DirectoryCapability, DirectoryEntryKind};
use crate::backup::windows_file_identity;

#[test]
fn relative_crud_listing_and_file_identity_are_handle_bound() {
    let root = temporary("windows-relative-crud");
    let backups = root.join("backups");
    fs::create_dir_all(&backups).unwrap();
    let capability = DirectoryCapability::acquire(&backups, false).unwrap();
    let temporary = format!(".bodam-backup-{}.tmp.bodam-backup", Uuid::new_v4());
    let target = "renamed.bodam-backup";
    let clone = "clone.bodam-backup";

    let mut created = capability.create_new(&temporary).unwrap();
    created.write_all(b"held bytes").unwrap();
    created.sync_all().unwrap();
    drop(created);
    let held = capability.open_regular(&temporary).unwrap();
    let first = capability.entries().unwrap();
    let second = capability.entries().unwrap();
    assert_eq!(
        first.iter().collect::<BTreeSet<_>>(),
        second.iter().collect::<BTreeSet<_>>()
    );

    capability.rename(&temporary, target).unwrap();
    let mut renamed = capability.open_regular(target).unwrap();
    assert!(windows_file_identity::same_file(&held, &renamed).unwrap());
    let mut bytes = Vec::new();
    renamed.read_to_end(&mut bytes).unwrap();
    assert_eq!(bytes, b"held bytes");

    let mut cloned = capability.create_new(clone).unwrap();
    cloned.write_all(&bytes).unwrap();
    cloned.sync_all().unwrap();
    assert!(!windows_file_identity::same_file(&held, &cloned).unwrap());
    drop((held, renamed, cloned));
    capability.remove_regular(target).unwrap();
    capability.remove_regular(clone).unwrap();
    assert_eq!(
        capability.entry_kind(target).unwrap(),
        DirectoryEntryKind::Missing
    );
    drop(capability);
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn selected_directory_name_swap_is_rejected_while_pinned_handle_stays_original() {
    let root = temporary("windows-directory-swap");
    let selected = root.join("backups");
    let replacement = root.join("replacement");
    fs::create_dir_all(&selected).unwrap();
    fs::create_dir(&replacement).unwrap();
    let capability = DirectoryCapability::acquire(&selected, false).unwrap();
    let original = root.join("original-backups");
    fs::rename(&selected, &original).unwrap();
    create_junction(&selected, &replacement);

    assert_eq!(
        capability.ensure_path_identity().unwrap_err().code,
        "BACKUP_PATH_UNAVAILABLE"
    );
    assert!(DirectoryCapability::acquire(&selected, false).is_err());
    let name = "pinned.bodam-backup";
    let mut file = capability.create_new(name).unwrap();
    file.write_all(b"original").unwrap();
    drop(file);
    assert_eq!(fs::read(original.join(name)).unwrap(), b"original");
    assert!(!replacement.join(name).exists());
    capability.remove_regular(name).unwrap();
    drop(capability);
    fs::remove_dir(&selected).unwrap();
    fs::remove_dir_all(root).unwrap();
}

#[test]
fn child_junction_cannot_be_opened_or_removed_as_a_regular_archive() {
    let root = temporary("windows-child-junction");
    let backups = root.join("backups");
    let foreign = root.join("foreign");
    fs::create_dir_all(&backups).unwrap();
    fs::create_dir(&foreign).unwrap();
    fs::write(foreign.join("keep.txt"), b"keep").unwrap();
    let capability = DirectoryCapability::acquire(&backups, false).unwrap();
    let name = "linked.bodam-backup";
    let link = backups.join(name);
    create_junction(&link, &foreign);

    assert_ne!(
        capability.entry_kind(name).ok(),
        Some(DirectoryEntryKind::RegularFile)
    );
    assert!(capability.open_regular(name).is_err());
    assert!(capability.remove_regular(name).is_err());
    assert_eq!(fs::read(foreign.join("keep.txt")).unwrap(), b"keep");
    drop(capability);
    fs::remove_dir(&link).unwrap();
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
