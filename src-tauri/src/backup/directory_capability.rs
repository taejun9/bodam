#[cfg(not(windows))]
use std::fs;
use std::fs::File;
use std::io;
use std::path::{Path, PathBuf};

#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
use std::fs::OpenOptions;

use super::file_ops::is_safe_basename;
#[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
use super::file_ops::validate_user_directory;
use super::BackupError;

#[cfg(windows)]
use super::directory_capability_windows::WindowsDirectory;

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
    pub(super) path: PathBuf,
    #[cfg(any(target_os = "macos", target_os = "linux"))]
    pub(super) descriptor: OwnedFd,
    #[cfg(windows)]
    pub(super) windows: WindowsDirectory,
}

impl DirectoryCapability {
    pub(super) fn acquire(path: &Path, require_canonical: bool) -> Result<Self, BackupError> {
        if !path.is_absolute() {
            return Err(BackupError::path_unavailable());
        }
        #[cfg(windows)]
        let capability = {
            let _ = require_canonical;
            let windows = WindowsDirectory::acquire(path)?;
            Self {
                path: path.to_owned(),
                windows,
            }
        };
        #[cfg(not(windows))]
        let canonical = fs::canonicalize(path).map_err(|_| BackupError::path_unavailable())?;
        #[cfg(not(windows))]
        if require_canonical && canonical != path {
            return Err(BackupError::path_unavailable());
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        let capability = Self::acquire_unix(canonical)?;
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
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
        #[cfg(windows)]
        {
            return self.windows.ensure_path_identity(&self.path);
        }
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
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
        {
            let current =
                fs::canonicalize(&self.path).map_err(|_| BackupError::path_unavailable())?;
            if current != self.path {
                return Err(BackupError::path_unavailable());
            }
            validate_user_directory(&current)
        }
    }

    pub(super) fn open_regular(&self, name: &str) -> Result<File, BackupError> {
        validate_name(name)?;
        #[cfg(windows)]
        {
            return self.windows.open_regular(name);
        }
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
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
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
        #[cfg(windows)]
        {
            return self.windows.create_new(name);
        }
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
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
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
        #[cfg(windows)]
        {
            return self.windows.rename(source, target);
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            unix_fs::renameat(&self.descriptor, source, &self.descriptor, target)
                .map_err(io::Error::from)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
        {
            fs::rename(self.path.join(source), self.path.join(target))
        }
    }

    pub(super) fn remove_regular(&self, name: &str) -> io::Result<()> {
        validate_name_io(name)?;
        if self.entry_kind(name).map_err(backup_io)? != DirectoryEntryKind::RegularFile {
            return Err(io::Error::other("backup entry is not a regular file"));
        }
        #[cfg(windows)]
        {
            return self.windows.remove_regular(name);
        }
        #[cfg(any(target_os = "macos", target_os = "linux"))]
        {
            unix_fs::unlinkat(&self.descriptor, name, AtFlags::empty()).map_err(io::Error::from)
        }
        #[cfg(not(any(target_os = "macos", target_os = "linux", windows)))]
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

pub(super) fn validate_name(name: &str) -> Result<(), BackupError> {
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

#[cfg(all(test, windows))]
#[path = "directory_capability_windows_tests.rs"]
mod windows_tests;
