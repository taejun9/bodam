use std::ffi::OsString;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

const RUNTIME_PREFIX: &str = "bodam-e2e-";

pub(crate) fn validate_database_path(value: Option<OsString>) -> io::Result<PathBuf> {
    let path = value.map(PathBuf::from).ok_or_else(invalid_path)?;
    if !path.is_absolute() || path.extension().and_then(|value| value.to_str()) != Some("sqlite3") {
        return Err(invalid_path());
    }
    let file_name = path.file_name().ok_or_else(invalid_path)?;
    let runtime = validate_runtime_directory(path.parent().ok_or_else(invalid_path)?)?;
    validate_existing_regular_file(&path)?;
    Ok(runtime.join(file_name))
}

pub(crate) fn validate_import_path(
    import_value: Option<OsString>,
    database_value: Option<OsString>,
) -> io::Result<PathBuf> {
    let database_path = validate_database_path(database_value)?;
    let runtime = database_path.parent().ok_or_else(invalid_path)?;
    let path = import_value.map(PathBuf::from).ok_or_else(invalid_path)?;
    let basename = path
        .file_name()
        .and_then(|value| value.to_str())
        .ok_or_else(invalid_path)?;
    let valid_extension = path
        .extension()
        .and_then(|value| value.to_str())
        .is_some_and(|value| {
            value.eq_ignore_ascii_case("xlsx") || value.eq_ignore_ascii_case("csv")
        });
    if !path.is_absolute() || !basename.starts_with("synthetic-") || !valid_extension {
        return Err(invalid_path());
    }

    let parent = path.parent().ok_or_else(invalid_path)?;
    let parent_metadata = fs::symlink_metadata(parent).map_err(|_| invalid_path())?;
    if !parent_metadata.file_type().is_dir() || parent_metadata.file_type().is_symlink() {
        return Err(invalid_path());
    }
    let resolved_parent = fs::canonicalize(parent).map_err(|_| invalid_path())?;
    if resolved_parent != runtime {
        return Err(invalid_path());
    }

    let metadata = fs::symlink_metadata(&path).map_err(|_| invalid_path())?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(invalid_path());
    }
    let resolved_file = fs::canonicalize(&path).map_err(|_| invalid_path())?;
    if resolved_file.parent() != Some(runtime) {
        return Err(invalid_path());
    }
    Ok(resolved_file)
}

fn validate_runtime_directory(path: &Path) -> io::Result<PathBuf> {
    let metadata = fs::symlink_metadata(path).map_err(|_| invalid_path())?;
    if !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(invalid_path());
    }
    let runtime = fs::canonicalize(path).map_err(|_| invalid_path())?;
    let temp_root = fs::canonicalize(std::env::temp_dir()).map_err(|_| invalid_path())?;
    let valid_name = runtime
        .file_name()
        .and_then(|value| value.to_str())
        .and_then(|value| value.strip_prefix(RUNTIME_PREFIX))
        .is_some_and(|suffix| !suffix.is_empty());
    if runtime.parent() != Some(temp_root.as_path()) || !valid_name {
        return Err(invalid_path());
    }
    Ok(runtime)
}

fn validate_existing_regular_file(path: &Path) -> io::Result<()> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_file() && !metadata.file_type().is_symlink() => {
            Ok(())
        }
        Err(error) if error.kind() == io::ErrorKind::NotFound => Ok(()),
        _ => Err(invalid_path()),
    }
}

fn invalid_path() -> io::Error {
    io::Error::other("BODAM E2E path is invalid")
}

#[cfg(test)]
mod tests {
    use super::{validate_database_path, validate_import_path};
    use std::ffi::OsString;
    use std::fs;
    use std::path::{Path, PathBuf};
    use uuid::Uuid;

    #[test]
    fn accepts_new_and_existing_database_files_in_a_canonical_temp_runtime() {
        let runtime = TestRuntime::new();
        let database = runtime.path().join("data-exchange.sqlite3");
        let expected = fs::canonicalize(runtime.path())
            .unwrap()
            .join("data-exchange.sqlite3");

        assert_eq!(validate_database_path(value(&database)).unwrap(), expected);
        fs::write(&database, b"synthetic database placeholder").unwrap();
        assert_eq!(validate_database_path(value(&database)).unwrap(), expected);
    }

    #[test]
    fn accepts_only_regular_synthetic_imports_from_the_database_runtime() {
        let runtime = TestRuntime::new();
        let database = runtime.path().join("data-exchange.sqlite3");
        let import = runtime.path().join("synthetic-contracts.csv");
        fs::write(&import, b"synthetic fixture").unwrap();

        assert_eq!(
            validate_import_path(value(&import), value(&database)).unwrap(),
            fs::canonicalize(&import).unwrap()
        );
        let wrong_name = runtime.path().join("contracts.csv");
        fs::write(&wrong_name, b"synthetic fixture").unwrap();
        assert!(validate_import_path(value(&wrong_name), value(&database)).is_err());
    }

    #[test]
    fn rejects_non_temp_runtime_and_existing_non_file_database_targets() {
        let outside = Path::new(env!("CARGO_MANIFEST_DIR")).join("outside.sqlite3");
        assert!(validate_database_path(value(&outside)).is_err());

        let wrong_name = TestRuntime::with_prefix("bodam-test-path-");
        assert!(validate_database_path(value(&wrong_name.path().join("state.sqlite3"))).is_err());

        let runtime = TestRuntime::new();
        let directory_target = runtime.path().join("directory.sqlite3");
        fs::create_dir(&directory_target).unwrap();
        assert!(validate_database_path(value(&directory_target)).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn rejects_database_file_symlinks_and_parent_symlink_escapes() {
        use std::os::unix::fs::symlink;

        let runtime = TestRuntime::new();
        let regular = runtime.path().join("regular.sqlite3");
        let linked = runtime.path().join("linked.sqlite3");
        fs::write(&regular, b"synthetic database placeholder").unwrap();
        symlink(&regular, &linked).unwrap();
        assert!(validate_database_path(value(&linked)).is_err());

        let source = runtime.path().join("source.csv");
        let linked_import = runtime.path().join("synthetic-linked.csv");
        fs::write(&source, b"synthetic fixture").unwrap();
        symlink(&source, &linked_import).unwrap();
        assert!(validate_import_path(
            value(&linked_import),
            value(&runtime.path().join("new.sqlite3")),
        )
        .is_err());

        let link = TempSymlink::to(Path::new(env!("CARGO_MANIFEST_DIR")));
        let escaped = link.path().join("escaped.sqlite3");
        assert!(validate_database_path(value(&escaped)).is_err());
    }

    fn value(path: &Path) -> Option<OsString> {
        Some(path.as_os_str().to_owned())
    }

    struct TestRuntime(PathBuf);

    impl TestRuntime {
        fn new() -> Self {
            Self::with_prefix("bodam-e2e-path-")
        }

        fn with_prefix(prefix: &str) -> Self {
            let path = std::env::temp_dir().join(format!("{prefix}{}", Uuid::new_v4()));
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

    #[cfg(unix)]
    struct TempSymlink(PathBuf);

    #[cfg(unix)]
    impl TempSymlink {
        fn to(target: &Path) -> Self {
            use std::os::unix::fs::symlink;

            let path = std::env::temp_dir().join(format!("bodam-e2e-link-{}", Uuid::new_v4()));
            symlink(target, &path).unwrap();
            Self(path)
        }

        fn path(&self) -> &Path {
            &self.0
        }
    }

    #[cfg(unix)]
    impl Drop for TempSymlink {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.0);
        }
    }
}
