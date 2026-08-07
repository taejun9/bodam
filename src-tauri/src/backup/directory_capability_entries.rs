#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
use std::{fs, io};

#[cfg(any(target_os = "macos", target_os = "linux"))]
use rustix::fs::{self as unix_fs, AtFlags, FileType};

use super::directory_capability::{DirectoryCapability, DirectoryEntryKind};
use super::BackupError;

impl DirectoryCapability {
    pub(super) fn entries(&self) -> Result<Vec<String>, BackupError> {
        #[cfg(windows)]
        {
            return self.windows.entries();
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            use std::os::unix::ffi::OsStrExt;

            let directory = unix_fs::Dir::read_from(&self.descriptor)
                .map_err(|_| BackupError::path_unavailable())?;
            let mut names = Vec::new();
            for entry in directory {
                let entry = entry.map_err(|_| BackupError::path_unavailable())?;
                let bytes = entry.file_name().to_bytes();
                if matches!(bytes, b"." | b"..") {
                    continue;
                }
                let Some(name) = std::ffi::OsStr::from_bytes(bytes).to_str() else {
                    continue;
                };
                names.push(name.to_owned());
            }
            Ok(names)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
        {
            let mut names = Vec::new();
            for entry in fs::read_dir(&self.path).map_err(|_| BackupError::path_unavailable())? {
                let entry = entry.map_err(|_| BackupError::path_unavailable())?;
                if let Ok(name) = entry.file_name().into_string() {
                    names.push(name);
                }
            }
            Ok(names)
        }
    }

    pub(super) fn entry_kind(&self, name: &str) -> Result<DirectoryEntryKind, BackupError> {
        super::directory_capability::validate_name(name)?;
        #[cfg(windows)]
        {
            return self.windows.entry_kind(name);
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            match unix_fs::statat(&self.descriptor, name, AtFlags::SYMLINK_NOFOLLOW) {
                Ok(stat) if FileType::from_raw_mode(stat.st_mode) == FileType::RegularFile => {
                    Ok(DirectoryEntryKind::RegularFile)
                }
                Ok(_) => Ok(DirectoryEntryKind::Other),
                Err(rustix::io::Errno::NOENT) => Ok(DirectoryEntryKind::Missing),
                Err(_) => Err(BackupError::path_unavailable()),
            }
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
        {
            match fs::symlink_metadata(self.path.join(name)) {
                Ok(metadata)
                    if metadata.file_type().is_file() && !metadata.file_type().is_symlink() =>
                {
                    Ok(DirectoryEntryKind::RegularFile)
                }
                Ok(_) => Ok(DirectoryEntryKind::Other),
                Err(error) if error.kind() == io::ErrorKind::NotFound => {
                    Ok(DirectoryEntryKind::Missing)
                }
                Err(_) => Err(BackupError::path_unavailable()),
            }
        }
    }
}
