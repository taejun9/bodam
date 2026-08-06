use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::directory_capability::DirectoryCapability;
use super::error::BackupError;

pub(super) trait AtomicReplacer: Send + Sync {
    fn replace(&self, source: &Path, target: &Path) -> io::Result<()>;

    fn replace_in(
        &self,
        directory: &DirectoryCapability,
        source: &str,
        target: &str,
    ) -> io::Result<()> {
        self.replace(
            &directory.path().join(source),
            &directory.path().join(target),
        )
    }
}

pub(super) struct OsAtomicReplacer;

impl AtomicReplacer for OsAtomicReplacer {
    fn replace(&self, source: &Path, target: &Path) -> io::Result<()> {
        replace_target(source, target)
    }

    fn replace_in(
        &self,
        directory: &DirectoryCapability,
        source: &str,
        target: &str,
    ) -> io::Result<()> {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            directory.rename(source, target)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            self.replace(
                &directory.path().join(source),
                &directory.path().join(target),
            )
        }
    }
}

pub(super) fn random_sibling(parent: &Path, prefix: &str, extension: &str) -> PathBuf {
    parent.join(format!(".{prefix}-{}.tmp.{extension}", Uuid::new_v4()))
}

pub(super) fn is_safe_basename(value: &str) -> bool {
    !value.is_empty()
        && value != "."
        && value != ".."
        && value.encode_utf16().count() <= 255
        && !value
            .chars()
            .any(|character| character.is_control() || matches!(character, '/' | '\\'))
}

pub(super) fn ensure_private_directory(path: &Path) -> Result<(), BackupError> {
    fs::create_dir_all(path).map_err(|_| BackupError::path_unavailable())?;
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::path_unavailable())?;
    if !path.is_absolute() || !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::path_unavailable());
    }
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        fs::set_permissions(path, fs::Permissions::from_mode(0o700))
            .map_err(|_| BackupError::path_unavailable())?;
    }
    Ok(())
}

pub(super) fn validate_user_directory(path: &Path) -> Result<(), BackupError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::path_unavailable())?;
    if !path.is_absolute() || !metadata.file_type().is_dir() || metadata.file_type().is_symlink() {
        return Err(BackupError::path_unavailable());
    }
    fs::read_dir(path).map_err(|_| BackupError::path_unavailable())?;
    let probe = random_sibling(path, "bodam-write-check", "tmp");
    let guard = SecureFile::create(&probe)?;
    drop(guard);
    Ok(())
}

pub(super) fn write_atomic(
    target: &Path,
    bytes: &[u8],
    replacer: &dyn AtomicReplacer,
) -> Result<(), BackupError> {
    let parent = target.parent().ok_or_else(BackupError::path_unavailable)?;
    ensure_private_directory(parent)?;
    let temporary = random_sibling(parent, "bodam-state", "json");
    let mut guard = SecureFile::create(&temporary)?;
    let file = guard.file_mut()?;
    file.write_all(bytes)
        .map_err(|_| BackupError::save_failed())?;
    file.flush().map_err(|_| BackupError::save_failed())?;
    file.sync_all().map_err(|_| BackupError::save_failed())?;
    guard.close();
    replacer
        .replace(&temporary, target)
        .map_err(|_| BackupError::save_failed())?;
    guard.keep();
    sync_parent(parent)?;
    Ok(())
}

pub(super) fn sync_parent(parent: &Path) -> Result<(), BackupError> {
    #[cfg(unix)]
    {
        File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|_| BackupError::save_failed())?;
    }
    Ok(())
}

pub(super) struct SecureFile {
    path: PathBuf,
    file: Option<File>,
    keep: bool,
}

impl SecureFile {
    pub(super) fn create(path: &Path) -> Result<Self, BackupError> {
        let mut options = OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(path)
            .map_err(|_| BackupError::path_unavailable())?;
        Ok(Self {
            path: path.to_owned(),
            file: Some(file),
            keep: false,
        })
    }

    pub(super) fn file_mut(&mut self) -> Result<&mut File, BackupError> {
        self.file.as_mut().ok_or_else(BackupError::save_failed)
    }

    #[cfg(test)]
    pub(super) fn take_file(&mut self) -> Result<File, BackupError> {
        self.file.take().ok_or_else(BackupError::save_failed)
    }

    pub(super) fn close(&mut self) {
        self.file.take();
    }

    pub(super) fn keep(mut self) {
        self.keep = true;
    }
}

impl Drop for SecureFile {
    fn drop(&mut self) {
        if !self.keep {
            self.file.take();
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[cfg(all(test, unix))]
mod tests {
    use std::fs;
    use std::os::unix::fs::PermissionsExt;
    use std::path::PathBuf;

    use uuid::Uuid;

    use super::{ensure_private_directory, validate_user_directory};

    #[test]
    fn user_directory_validation_never_rewrites_existing_permissions() {
        let path = temporary("user-directory");
        fs::create_dir(&path).unwrap();
        fs::set_permissions(&path, fs::Permissions::from_mode(0o755)).unwrap();
        validate_user_directory(&path).unwrap();
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o755
        );
        fs::remove_dir(path).unwrap();
    }

    #[test]
    fn app_owned_directory_is_restricted_to_the_current_account() {
        let path = temporary("private-directory");
        ensure_private_directory(&path).unwrap();
        assert_eq!(
            fs::metadata(&path).unwrap().permissions().mode() & 0o777,
            0o700
        );
        fs::remove_dir(path).unwrap();
    }

    fn temporary(label: &str) -> PathBuf {
        std::env::temp_dir().join(format!("bodam-{label}-{}", Uuid::new_v4()))
    }
}

#[cfg(not(windows))]
fn replace_target(source: &Path, target: &Path) -> io::Result<()> {
    fs::rename(source, target)
}

#[cfg(windows)]
fn replace_target(source: &Path, target: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const REPLACE_EXISTING: u32 = 0x0000_0001;
    const WRITE_THROUGH: u32 = 0x0000_0008;
    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
    }
    let source = source
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            REPLACE_EXISTING | WRITE_THROUGH,
        )
    };
    (replaced != 0)
        .then_some(())
        .ok_or_else(io::Error::last_os_error)
}
