use std::fs::File;
use std::io;
use std::path::Path;
use std::sync::Mutex;

use windows_sys::Wdk::Storage::FileSystem::{
    FILE_CREATE, FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN,
};
use windows_sys::Win32::Foundation::{ERROR_FILE_NOT_FOUND, ERROR_PATH_NOT_FOUND};
use windows_sys::Win32::Storage::FileSystem::{
    DELETE, FILE_GENERIC_READ, FILE_GENERIC_WRITE, FILE_LIST_DIRECTORY, FILE_READ_ATTRIBUTES,
    FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, SYNCHRONIZE,
};

use super::directory_capability::DirectoryEntryKind;
use super::directory_entries_windows;
use super::windows_file_identity::{self, FileIdentity};
use super::windows_handle;
use super::windows_local_path;
use super::BackupError;

#[derive(Debug)]
pub(super) struct WindowsDirectory {
    handle: File,
    identity: FileIdentity,
    scan: Mutex<()>,
}

impl WindowsDirectory {
    pub(super) fn acquire(path: &Path) -> Result<Self, BackupError> {
        let (mut handle, components) = windows_local_path::open_fixed_drive_root(path)
            .map_err(|_| BackupError::path_unavailable())?;
        ensure_directory(&handle)?;
        for component in components {
            handle = windows_handle::open_relative(
                &handle,
                &component,
                FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
                share_all(),
                FILE_OPEN,
                FILE_DIRECTORY_FILE,
            )
            .map_err(|_| BackupError::path_unavailable())?;
            ensure_directory(&handle)?;
        }
        windows_local_path::ensure_ntfs(&handle, true)
            .map_err(|_| BackupError::path_unavailable())?;
        let identity = windows_file_identity::query(&handle)
            .map_err(|_| BackupError::path_unavailable())?
            .identity;
        Ok(Self {
            handle,
            identity,
            scan: Mutex::new(()),
        })
    }

    pub(super) fn ensure_path_identity(&self, path: &Path) -> Result<(), BackupError> {
        let current = Self::acquire(path)?;
        if current.identity != self.identity {
            return Err(BackupError::path_unavailable());
        }
        Ok(())
    }

    pub(super) fn entries(&self) -> Result<Vec<String>, BackupError> {
        directory_entries_windows::list(&self.handle, &self.scan)
            .map_err(|_| BackupError::path_unavailable())
    }

    pub(super) fn entry_kind(&self, name: &str) -> Result<DirectoryEntryKind, BackupError> {
        let file = match windows_handle::open_relative(
            &self.handle,
            name.as_ref(),
            FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            share_all(),
            FILE_OPEN,
            0,
        ) {
            Ok(file) => file,
            Err(error) if is_not_found(&error) => return Ok(DirectoryEntryKind::Missing),
            Err(_) => return Err(BackupError::path_unavailable()),
        };
        let metadata =
            windows_file_identity::query(&file).map_err(|_| BackupError::path_unavailable())?;
        if metadata.is_regular_without_reparse() {
            Ok(DirectoryEntryKind::RegularFile)
        } else {
            Ok(DirectoryEntryKind::Other)
        }
    }

    pub(super) fn open_regular(&self, name: &str) -> Result<File, BackupError> {
        let file = windows_handle::open_relative(
            &self.handle,
            name.as_ref(),
            FILE_GENERIC_READ,
            share_all(),
            FILE_OPEN,
            FILE_NON_DIRECTORY_FILE,
        )
        .map_err(|_| BackupError::path_unavailable())?;
        ensure_regular(&file)?;
        Ok(file)
    }

    pub(super) fn create_new(&self, name: &str) -> Result<File, BackupError> {
        let file = windows_handle::open_relative(
            &self.handle,
            name.as_ref(),
            FILE_GENERIC_READ | FILE_GENERIC_WRITE | DELETE,
            share_all(),
            FILE_CREATE,
            FILE_NON_DIRECTORY_FILE,
        )
        .map_err(|_| BackupError::path_unavailable())?;
        ensure_regular(&file)?;
        Ok(file)
    }

    pub(super) fn rename(&self, source: &str, target: &str) -> io::Result<()> {
        let source = self.open_rename_handle(source)?;
        windows_handle::rename_relative(&source, &self.handle, target)
    }

    pub(super) fn remove_regular(&self, name: &str) -> io::Result<()> {
        let file = self.open_delete_handle(name)?;
        windows_handle::mark_delete(&file)
    }

    fn open_delete_handle(&self, name: &str) -> io::Result<File> {
        let file = windows_handle::open_relative(
            &self.handle,
            name.as_ref(),
            DELETE | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            share_all(),
            FILE_OPEN,
            FILE_NON_DIRECTORY_FILE,
        )?;
        if !windows_file_identity::query(&file)?.is_regular_without_reparse() {
            return Err(io::Error::other("backup entry is not a regular file"));
        }
        Ok(file)
    }

    fn open_rename_handle(&self, name: &str) -> io::Result<File> {
        let file = windows_handle::open_relative(
            &self.handle,
            name.as_ref(),
            DELETE | FILE_GENERIC_WRITE | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            share_all(),
            FILE_OPEN,
            FILE_NON_DIRECTORY_FILE,
        )?;
        if !windows_file_identity::query(&file)?.is_regular_without_reparse() {
            return Err(io::Error::other("backup entry is not a regular file"));
        }
        Ok(file)
    }
}

fn ensure_directory(file: &File) -> Result<(), BackupError> {
    windows_file_identity::query(file)
        .map_err(|_| BackupError::path_unavailable())?
        .is_directory_without_reparse()
        .then_some(())
        .ok_or_else(BackupError::path_unavailable)
}

fn ensure_regular(file: &File) -> Result<(), BackupError> {
    windows_file_identity::query(file)
        .map_err(|_| BackupError::path_unavailable())?
        .is_regular_without_reparse()
        .then_some(())
        .ok_or_else(BackupError::path_unavailable)
}

fn share_all() -> u32 {
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
}

fn is_not_found(error: &io::Error) -> bool {
    matches!(
        error.raw_os_error().map(|value| value as u32),
        Some(code) if code == ERROR_FILE_NOT_FOUND || code == ERROR_PATH_NOT_FOUND
    )
}
