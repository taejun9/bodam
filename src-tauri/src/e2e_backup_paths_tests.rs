use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::{validate_app_data_directory, validate_backup_directory, validate_restore_file};

#[test]
fn app_data_is_the_validated_canonical_database_runtime() {
    let runtime = TestRuntime::new();
    let database = runtime.path().join("bodam-e2e.sqlite3");
    assert_eq!(
        validate_app_data_directory(value(&database)).unwrap(),
        fs::canonicalize(runtime.path()).unwrap()
    );
}

#[test]
fn validates_synthetic_dialog_targets_in_the_same_runtime() {
    let runtime = TestRuntime::new();
    let database = runtime.path().join("bodam-e2e.sqlite3");
    let directory = runtime.path().join("synthetic-backups");
    fs::create_dir(&directory).unwrap();
    let restore = directory
        .join("BODAM-manual-20260807T010203004Z-12000000-0000-4000-8000-000000000001.bodam-backup");
    fs::write(&restore, b"synthetic archive placeholder").unwrap();

    assert_eq!(
        validate_backup_directory(value(&directory), value(&database)).unwrap(),
        Some(fs::canonicalize(&directory).unwrap())
    );
    assert_eq!(
        validate_restore_file(value(&restore), value(&directory), value(&database)).unwrap(),
        Some(fs::canonicalize(&restore).unwrap())
    );
}

#[test]
fn absent_dialog_values_are_cancellation_without_mutation() {
    assert_eq!(validate_backup_directory(None, None).unwrap(), None);
    assert_eq!(validate_restore_file(None, None, None).unwrap(), None);
}

#[test]
fn rejects_relative_wrong_name_type_extension_and_other_runtime() {
    let runtime = TestRuntime::new();
    let other = TestRuntime::new();
    let database = runtime.path().join("bodam-e2e.sqlite3");
    let wrong_name = runtime.path().join("backups");
    let wrong_type = runtime.path().join("synthetic-file");
    let directory = runtime.path().join("synthetic-backups");
    let wrong_extension = directory.join("BODAM-manual-restore.zip");
    let arbitrary = directory.join("synthetic-restore.bodam-backup");
    let root_artifact = runtime
        .path()
        .join("BODAM-manual-20260807T010203004Z-12000000-0000-4000-8000-000000000001.bodam-backup");
    let other_directory = other.path().join("synthetic-backups");
    fs::create_dir(&wrong_name).unwrap();
    fs::write(&wrong_type, b"synthetic fixture").unwrap();
    fs::create_dir(&directory).unwrap();
    fs::write(&wrong_extension, b"synthetic fixture").unwrap();
    fs::write(&arbitrary, b"synthetic fixture").unwrap();
    fs::write(&root_artifact, b"synthetic fixture").unwrap();
    fs::create_dir(&other_directory).unwrap();

    for rejected in [
        PathBuf::from("synthetic-backups"),
        wrong_name,
        wrong_type,
        other_directory,
    ] {
        assert!(validate_backup_directory(value(&rejected), value(&database)).is_err());
    }
    for rejected in [wrong_extension, arbitrary, root_artifact] {
        assert!(
            validate_restore_file(value(&rejected), value(&directory), value(&database),).is_err()
        );
    }
}

#[cfg(unix)]
#[test]
fn rejects_symlinked_dialog_targets() {
    use std::os::unix::fs::symlink;

    let runtime = TestRuntime::new();
    let database = runtime.path().join("bodam-e2e.sqlite3");
    let real_directory = runtime.path().join("synthetic-real");
    let linked_directory = runtime.path().join("synthetic-linked");
    fs::create_dir(&real_directory).unwrap();
    symlink(&real_directory, &linked_directory).unwrap();
    assert!(validate_backup_directory(value(&linked_directory), value(&database)).is_err());

    let backup_directory = runtime.path().join("synthetic-backups");
    fs::create_dir(&backup_directory).unwrap();
    let real_file = backup_directory
        .join("BODAM-manual-20260807T010203004Z-12000000-0000-4000-8000-000000000001.bodam-backup");
    let linked_file = backup_directory
        .join("BODAM-manual-20260807T010203004Z-22000000-0000-4000-8000-000000000002.bodam-backup");
    fs::write(&real_file, b"synthetic fixture").unwrap();
    symlink(&real_file, &linked_file).unwrap();
    assert!(validate_restore_file(
        value(&linked_file),
        value(&backup_directory),
        value(&database),
    )
    .is_err());
}

fn value(path: &Path) -> Option<OsString> {
    Some(path.as_os_str().to_owned())
}

struct TestRuntime(PathBuf);

impl TestRuntime {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-e2e-backup-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }
}

impl Drop for TestRuntime {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
