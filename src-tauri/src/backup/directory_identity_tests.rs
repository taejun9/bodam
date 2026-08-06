use std::fs;

use uuid::Uuid;

use super::{canonicalize_selected_directory, validate_directory_identity};

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[test]
fn selection_resolves_a_symlinked_ancestor_and_pins_the_final_directory() {
    use std::os::unix::fs::symlink;

    let root = temporary_root();
    let target_parent = root.join("target-parent");
    let target = target_parent.join("backups");
    fs::create_dir_all(&target).unwrap();
    let alias = root.join("selected-parent");
    symlink(&target_parent, &alias).unwrap();

    let selected = canonicalize_selected_directory(&alias.join("backups")).unwrap();

    assert_eq!(selected, fs::canonicalize(&target).unwrap());
    let replacement_parent = root.join("replacement-parent");
    fs::create_dir_all(replacement_parent.join("backups")).unwrap();
    fs::remove_file(&alias).unwrap();
    symlink(&replacement_parent, &alias).unwrap();
    let replacement = fs::canonicalize(alias.join("backups")).unwrap();
    assert_eq!(selected, fs::canonicalize(&target).unwrap());
    assert_ne!(selected, replacement);
    validate_directory_identity(&selected).unwrap();
    assert!(validate_directory_identity(&alias.join("backups")).is_err());
    fs::remove_dir_all(root).unwrap();
}

fn temporary_root() -> std::path::PathBuf {
    let path = std::env::temp_dir().join(format!("bodam-directory-identity-{}", Uuid::new_v4()));
    fs::create_dir(&path).unwrap();
    fs::canonicalize(path).unwrap()
}
