use std::fs::{self, File};
use std::io;
use std::path::{Path, PathBuf};

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
use std::fs::OpenOptions;

use super::file_ops::is_safe_basename;
#[cfg(not(any(target_os = "macos", target_os = "linux")))]
use super::file_ops::validate_user_directory;
use super::BackupError;

#[cfg(any(target_os = "macos", target_os = "linux"))]
use super::directory_capability_unix::open_absolute_directory;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use rustix::fd::OwnedFd;
#[cfg(any(target_os = "macos", target_os = "linux"))]
use rustix::fs::{self as unix_fs, AtFlags, FileType, Mode, OFlags};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) enum DirectoryEntryKind {
    Missing,
    RegularFile,
    Other,
}

#[derive(Debug)]
pub(super) struct DirectoryCapability {
    path: PathBuf,
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    descriptor: OwnedFd,
}

impl DirectoryCapability {
    pub(super) fn acquire(path: &Path, require_canonical: bool) -> Result<Self, BackupError> {
        if !path.is_absolute() {
            return Err(BackupError::path_unavailable());
        }
        let canonical = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
        if require_canonical && canonical != path {
            return Err(BackupError::path_unavailable());
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        let capability = Self::acquire_unix(canonical)?;
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        let capability = {
            validate_user_directory(&canonical)?;
            Self { path: canonical }
        };
        capability.probe_writable()?;
        Ok(capability)
    }

    pub(super) fn path(&self) -> &Path {
        &self.path
    }

    pub(super) fn ensure_path_identity(&self) -> Result<(), BackupError> {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let current =
                open_absolute_directory(&self.path).map_err(|_| BackupError::path_unavailable())?;
            let expected =
                unix_fs::fstat(&self.descriptor).map_err(|_| BackupError::path_unavailable())?;
            let actual = unix_fs::fstat(&current).map_err(|_| BackupError::path_unavailable())?;
            if expected.st_dev != actual.st_dev || expected.st_ino != actual.st_ino {
                return Err(BackupError::path_unavailable());
            }
            Ok(())
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            let current =
                fs::canonicalize(&self.path).map_err(|_| BackupError::path_unavailable())?;
            if current != self.path {
                return Err(BackupError::path_unavailable());
            }
            validate_user_directory(&current)
        }
    }

    pub(super) fn entries(&self) -> Result<Vec<String>, BackupError> {
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
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
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
        validate_name(name)?;
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
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
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

    pub(super) fn open_regular(&self, name: &str) -> Result<File, BackupError> {
        validate_name(name)?;
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let descriptor = unix_fs::openat(
                &self.descriptor,
                name,
                OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
                Mode::empty(),
            )
            .map_err(|_| BackupError::path_unavailable())?;
            let stat = unix_fs::fstat(&descriptor).map_err(|_| BackupError::path_unavailable())?;
            if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
                return Err(BackupError::path_unavailable());
            }
            Ok(File::from(descriptor))
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            if self.entry_kind(name)? != DirectoryEntryKind::RegularFile {
                return Err(BackupError::path_unavailable());
            }
            let file =
                File::open(self.path.join(name)).map_err(|_| BackupError::path_unavailable())?;
            if !file.metadata().is_ok_and(|metadata| metadata.is_file()) {
                return Err(BackupError::path_unavailable());
            }
            Ok(file)
        }
    }

    pub(super) fn create_new(&self, name: &str) -> Result<File, BackupError> {
        validate_name(name)?;
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            let descriptor = unix_fs::openat(
                &self.descriptor,
                name,
                OFlags::RDWR | OFlags::CREATE | OFlags::EXCL | OFlags::CLOEXEC | OFlags::NOFOLLOW,
                Mode::RUSR | Mode::WUSR,
            )
            .map_err(|_| BackupError::path_unavailable())?;
            Ok(File::from(descriptor))
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            OpenOptions::new()
                .read(true)
                .write(true)
                .create_new(true)
                .open(self.path.join(name))
                .map_err(|_| BackupError::path_unavailable())
        }
    }

    pub(super) fn rename(&self, source: &str, target: &str) -> io::Result<()> {
        validate_name_io(source)?;
        validate_name_io(target)?;
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            unix_fs::renameat(&self.descriptor, source, &self.descriptor, target)
                .map_err(io::Error::from)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            fs::rename(self.path.join(source), self.path.join(target))
        }
    }

    pub(super) fn remove_regular(&self, name: &str) -> io::Result<()> {
        validate_name_io(name)?;
        if self.entry_kind(name).map_err(backup_io)? != DirectoryEntryKind::RegularFile {
            return Err(io::Error::other("backup entry is not a regular file"));
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            unix_fs::unlinkat(&self.descriptor, name, AtFlags::empty()).map_err(io::Error::from)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            fs::remove_file(self.path.join(name))
        }
    }

    pub(super) fn sync(&self) -> io::Result<()> {
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            unix_fs::fsync(&self.descriptor).map_err(io::Error::from)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux")))]
        {
            Ok(())
        }
    }

    #[cfg(any(target_os = "macos", target_os = "linux"))]
    fn acquire_unix(canonical: PathBuf) -> Result<Self, BackupError> {
        use std::os::unix::fs::MetadataExt;

        let expected =
            fs::symlink_metadata(&canonical).map_err(|_| BackupError::path_unavailable())?;
        if !expected.file_type().is_dir() || expected.file_type().is_symlink() {
            return Err(BackupError::path_unavailable());
        }
        let descriptor =
            open_absolute_directory(&canonical).map_err(|_| BackupError::path_unavailable())?;
        let actual = unix_fs::fstat(&descriptor).map_err(|_| BackupError::path_unavailable())?;
        if FileType::from_raw_mode(actual.st_mode) != FileType::Directory
            || expected.dev() != actual.st_dev as u64
            || expected.ino() != actual.st_ino as u64
        {
            return Err(BackupError::path_unavailable());
        }
        Ok(Self {
            path: canonical,
            descriptor,
        })
    }
}

fn validate_name(name: &str) -> Result<(), BackupError> {
    is_safe_basename(name)
        .then_some(())
        .ok_or_else(BackupError::path_unavailable)
}

fn validate_name_io(name: &str) -> io::Result<()> {
    is_safe_basename(name)
        .then_some(())
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "unsafe backup basename"))
}

fn backup_io(_: BackupError) -> io::Error {
    io::Error::other("backup path unavailable")
}

#[cfg(test)]
#[path = "directory_capability_tests.rs"]
mod tests;
