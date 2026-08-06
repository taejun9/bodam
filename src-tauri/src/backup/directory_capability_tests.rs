#![cfg(any(target_os = "macos", target_os = "linux"))]

use std::collections::BTreeSet;
use std::fs;
use std::io::Write;
use std::os::unix::fs::symlink;
use std::path::PathBuf;

use uuid::Uuid;

use super::DirectoryCapability;

#[test]
fn pinned_directory_survives_ancestor_retarget_and_repeated_listing() {
    let root = temporary("pinned-directory");
    let selected_parent = root.join("selected-parent");
    let selected = selected_parent.join("backups");
    let replacement = root.join("replacement");
    fs::create_dir_all(&selected).unwrap();
    fs::create_dir_all(replacement.join("backups")).unwrap();
    let selected = fs::canonicalize(&selected).unwrap();
    let capability = DirectoryCapability::acquire(&selected, true).unwrap();
    let original_parent = root.join("original-parent");
    fs::rename(&selected_parent, &original_parent).unwrap();
    symlink(&replacement, &selected_parent).unwrap();
    assert_eq!(
        capability.ensure_path_identity().unwrap_err().code,
        "BACKUP_PATH_UNAVAILABLE"
    );

    let temporary = format!(".bodam-backup-{}.tmp.bodam-backup", Uuid::new_v4());
    let target = "pinned.bodam-backup";
    let mut file = capability.create_new(&temporary).unwrap();
    file.write_all(b"pinned").unwrap();
    file.sync_all().unwrap();
    drop(file);
    capability.rename(&temporary, target).unwrap();
    capability.sync().unwrap();

    let first = capability.entries().unwrap();
    let second = capability.entries().unwrap();
    assert!(!first.is_empty());
    assert!(!second.is_empty());
    assert_eq!(
        first.iter().collect::<BTreeSet<_>>(),
        second.iter().collect::<BTreeSet<_>>()
    );
    assert!(first.iter().any(|name| name == target));
    assert_eq!(
        fs::read(original_parent.join("backups").join(target)).unwrap(),
        b"pinned"
    );
    assert!(!replacement.join("backups").join(target).exists());

    capability.remove_regular(target).unwrap();
    capability.sync().unwrap();
    assert!(!original_parent.join("backups").join(target).exists());
    assert!(fs::read_dir(replacement.join("backups"))
        .unwrap()
        .next()
        .is_none());
    fs::remove_dir_all(root).unwrap();
}

fn temporary(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!("bodam-{label}-{}", Uuid::new_v4()))
}
