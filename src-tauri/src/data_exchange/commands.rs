use super::error::ImportFileError;
use super::model::ParsedImportFile;
use super::parser::parse_import_path;
use tauri::AppHandle;
use tauri_plugin_dialog::DialogExt;

#[cfg(feature = "e2e")]
#[path = "commands_e2e.rs"]
mod e2e;

#[tauri::command]
pub(crate) async fn choose_contract_import_file(
    app: AppHandle,
) -> Result<Option<ParsedImportFile>, ImportFileError> {
    tauri::async_runtime::spawn_blocking(move || choose_import_file(app))
        .await
        .map_err(|_| {
            ImportFileError::new("WORKER_UNAVAILABLE", "파일 읽기 작업을 완료할 수 없습니다.")
        })?
}

fn choose_native_import_file(app: AppHandle) -> Result<Option<ParsedImportFile>, ImportFileError> {
    let selected = app
        .dialog()
        .file()
        .set_title("계약조회 파일 선택")
        .add_filter("계약조회 파일", &["xlsx", "csv"])
        .blocking_pick_file();
    let Some(file_path) = selected else {
        return Ok(None);
    };
    let path = file_path.into_path().map_err(|_| {
        ImportFileError::new(
            "FILE_UNAVAILABLE",
            "선택한 파일을 안전하게 읽을 수 없습니다.",
        )
    })?;
    parse_import_path(&path).map(Some)
}

#[cfg(not(feature = "e2e"))]
fn choose_import_file(app: AppHandle) -> Result<Option<ParsedImportFile>, ImportFileError> {
    choose_native_import_file(app)
}

#[cfg(feature = "e2e")]
fn choose_import_file(app: AppHandle) -> Result<Option<ParsedImportFile>, ImportFileError> {
    let import_path = std::env::var_os("BODAM_E2E_IMPORT_PATH");
    if import_path.is_none() {
        let native_dialog = std::env::var_os("BODAM_E2E_NATIVE_DIALOG");
        if e2e::native_dialog_enabled(native_dialog.as_deref()) {
            return choose_native_import_file(app);
        }
    }
    let database_path = std::env::var_os("BODAM_E2E_DB_PATH");
    parse_e2e_import_file(import_path, database_path).map(Some)
}

#[cfg(feature = "e2e")]
fn parse_e2e_import_file(
    import_path: Option<std::ffi::OsString>,
    database_path: Option<std::ffi::OsString>,
) -> Result<ParsedImportFile, ImportFileError> {
    let path = validate_e2e_import_path(import_path, database_path)?;
    parse_import_path(&path)
}

#[cfg(feature = "e2e")]
fn validate_e2e_import_path(
    import_path: Option<std::ffi::OsString>,
    database_path: Option<std::ffi::OsString>,
) -> Result<std::path::PathBuf, ImportFileError> {
    crate::e2e_paths::validate_import_path(import_path, database_path)
        .map_err(|_| e2e_import_error())
}

#[cfg(feature = "e2e")]
fn e2e_import_error() -> ImportFileError {
    ImportFileError::new(
        "E2E_IMPORT_FILE_INVALID",
        "E2E 가져오기 파일 구성을 확인할 수 없습니다.",
    )
}

#[cfg(all(test, feature = "e2e"))]
mod tests {
    use super::{parse_e2e_import_file, validate_e2e_import_path};
    use std::ffi::OsString;
    use std::path::{Path, PathBuf};
    use uuid::Uuid;

    #[test]
    fn parses_synthetic_fixtures_from_the_database_directory() {
        let directory = TestDirectory::new();
        let database_path = directory.path().join("bodam-e2e.sqlite3");
        for basename in [
            "synthetic-contracts-valid.csv",
            "synthetic-contracts-valid.xlsx",
        ] {
            let import_path = directory.path().join(basename);
            let fixture = Path::new(env!("CARGO_MANIFEST_DIR"))
                .join("../tests/fixtures/synthetic")
                .join(basename);
            std::fs::copy(fixture, &import_path).unwrap();
            let parsed = parse_e2e_import_file(
                Some(import_path.into_os_string()),
                Some(database_path.clone().into_os_string()),
            )
            .unwrap();

            assert_eq!(parsed.basename, basename);
            assert!(!parsed.rows.is_empty());
        }
    }

    #[test]
    fn rejects_missing_relative_wrong_name_extension_and_parent() {
        let directory = TestDirectory::new();
        let database_path = directory.path().join("bodam-e2e.sqlite3");
        let valid = directory.path().join("synthetic-contracts.csv");
        std::fs::write(&valid, b"fixture").unwrap();
        let other_parent = directory.path().join("other");
        std::fs::create_dir(&other_parent).unwrap();
        let cases = [
            (None, Some(database_path.clone().into_os_string())),
            (
                Some(OsString::from("synthetic-contracts.csv")),
                Some(database_path.clone().into_os_string()),
            ),
            (
                Some(valid.clone().into_os_string()),
                Some(OsString::from("bodam-e2e.sqlite3")),
            ),
            (
                Some(directory.path().join("contracts.csv").into_os_string()),
                Some(database_path.clone().into_os_string()),
            ),
            (
                Some(
                    directory
                        .path()
                        .join("synthetic-contracts.xls")
                        .into_os_string(),
                ),
                Some(database_path.clone().into_os_string()),
            ),
            (
                Some(
                    other_parent
                        .join("synthetic-contracts.csv")
                        .into_os_string(),
                ),
                Some(database_path.clone().into_os_string()),
            ),
            (Some(valid.clone().into_os_string()), None),
        ];

        for (import_path, database_path) in cases {
            let error = validate_e2e_import_path(import_path, database_path).unwrap_err();
            assert_eq!(error.code, "E2E_IMPORT_FILE_INVALID");
        }
    }

    #[test]
    fn safe_errors_do_not_contain_rejected_paths() {
        let directory = TestDirectory::new();
        let rejected = directory.path().join("private-contract.csv");
        let database_path = directory.path().join("bodam-e2e.sqlite3");
        let error = validate_e2e_import_path(
            Some(rejected.clone().into_os_string()),
            Some(database_path.into_os_string()),
        )
        .unwrap_err();
        let serialized = serde_json::to_string(&error).unwrap();

        assert!(!serialized.contains(rejected.to_string_lossy().as_ref()));
    }

    struct TestDirectory(PathBuf);

    impl TestDirectory {
        fn new() -> Self {
            let path = std::env::temp_dir().join(format!("bodam-e2e-import-{}", Uuid::new_v4()));
            std::fs::create_dir(&path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    impl Drop for TestDirectory {
        fn drop(&mut self) {
            let _ = std::fs::remove_dir_all(&self.0);
        }
    }
}
