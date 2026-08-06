use std::fs;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::{replace_target, save_verified_export};
use crate::data_exchange::export_csv::build_csv;
use crate::data_exchange::export_model::ContractExportFormat;
use crate::data_exchange::export_test_support::export_row;

#[test]
fn atomically_replaces_an_existing_target_without_temp_artifacts() {
    let directory = TestDirectory::new();
    let target = directory.path().join("contracts.csv");
    fs::write(&target, b"existing target").unwrap();
    let rows = [export_row("saved", Some("2026-08-07"))];
    let bytes = build_csv(&rows).unwrap();

    let basename = save_verified_export(&target, ContractExportFormat::Csv, &rows, &bytes).unwrap();
    assert_eq!(basename, "contracts.csv");
    assert_eq!(fs::read(&target).unwrap(), bytes);
    assert_eq!(directory.entries(), vec!["contracts.csv"]);
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;

        assert_eq!(
            fs::metadata(&target).unwrap().permissions().mode() & 0o777,
            0o600
        );
    }
}

#[test]
fn verification_failure_preserves_target_and_removes_temp() {
    let directory = TestDirectory::new();
    let target = directory.path().join("contracts.csv");
    fs::write(&target, b"existing target").unwrap();
    let written = [export_row("written", None)];
    let expected = [export_row("different", None)];
    let bytes = build_csv(&written).unwrap();

    let error =
        save_verified_export(&target, ContractExportFormat::Csv, &expected, &bytes).unwrap_err();
    assert_eq!(error.code, "EXPORT_VERIFICATION_FAILED");
    assert_eq!(fs::read(&target).unwrap(), b"existing target");
    assert_eq!(directory.entries(), vec!["contracts.csv"]);
}

#[test]
fn wrong_extension_and_failed_replace_leave_existing_objects_intact() {
    let directory = TestDirectory::new();
    let target = directory.path().join("contracts.xlsx");
    fs::write(&target, b"existing target").unwrap();
    let rows = [export_row("wrong-extension", None)];
    let bytes = build_csv(&rows).unwrap();
    let error =
        save_verified_export(&target, ContractExportFormat::Csv, &rows, &bytes).unwrap_err();
    assert_eq!(error.code, "EXPORT_PATH_INVALID");
    assert_eq!(fs::read(&target).unwrap(), b"existing target");

    let source = directory.path().join("source.tmp");
    let directory_target = directory.path().join("target-directory");
    fs::write(&source, b"temporary bytes").unwrap();
    fs::create_dir(&directory_target).unwrap();
    assert!(replace_target(&source, &directory_target).is_err());
    assert_eq!(fs::read(&source).unwrap(), b"temporary bytes");
    assert!(directory_target.is_dir());
}

#[cfg(unix)]
#[test]
fn rejects_symlink_and_directory_targets_without_following_them() {
    use std::os::unix::fs::symlink;

    let directory = TestDirectory::new();
    let real = directory.path().join("real.csv");
    let linked = directory.path().join("linked.csv");
    fs::write(&real, b"existing target").unwrap();
    symlink(&real, &linked).unwrap();
    let rows = [export_row("symlink", None)];
    let bytes = build_csv(&rows).unwrap();
    assert_eq!(
        save_verified_export(&linked, ContractExportFormat::Csv, &rows, &bytes)
            .unwrap_err()
            .code,
        "EXPORT_PATH_INVALID"
    );
    assert_eq!(fs::read(&real).unwrap(), b"existing target");

    let directory_target = directory.path().join("directory.csv");
    fs::create_dir(&directory_target).unwrap();
    assert_eq!(
        save_verified_export(&directory_target, ContractExportFormat::Csv, &rows, &bytes)
            .unwrap_err()
            .code,
        "EXPORT_PATH_INVALID"
    );
}

struct TestDirectory(PathBuf);

impl TestDirectory {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-export-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn entries(&self) -> Vec<String> {
        let mut entries = fs::read_dir(&self.0)
            .unwrap()
            .map(|entry| entry.unwrap().file_name().to_string_lossy().into_owned())
            .collect::<Vec<_>>();
        entries.sort();
        entries
    }
}

impl Drop for TestDirectory {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
