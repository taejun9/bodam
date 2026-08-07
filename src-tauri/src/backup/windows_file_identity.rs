use std::fs::File;
use std::io;
use std::os::windows::io::AsRawHandle;
use std::path::Path;

use windows_sys::Wdk::Storage::FileSystem::{
    FILE_DIRECTORY_FILE, FILE_NON_DIRECTORY_FILE, FILE_OPEN,
};
use windows_sys::Win32::Foundation::HANDLE;
use windows_sys::Win32::Storage::FileSystem::{
    GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION, FILE_ATTRIBUTE_DIRECTORY,
    FILE_ATTRIBUTE_REPARSE_POINT, FILE_GENERIC_READ, FILE_LIST_DIRECTORY, FILE_READ_ATTRIBUTES,
    FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, SYNCHRONIZE,
};

use super::BackupError;
use super::{windows_handle, windows_local_path};

#[derive(Clone, Copy, Debug, Eq, PartialEq)]
pub(super) struct FileIdentity {
    volume_serial: u32,
    file_index: u64,
}

#[derive(Clone, Copy, Debug)]
pub(super) struct HandleMetadata {
    pub(super) identity: FileIdentity,
    pub(super) attributes: u32,
    pub(super) size: u64,
}

impl HandleMetadata {
    pub(super) fn is_directory_without_reparse(self) -> bool {
        self.attributes & FILE_ATTRIBUTE_DIRECTORY != 0
            && self.attributes & FILE_ATTRIBUTE_REPARSE_POINT == 0
    }

    pub(super) fn is_regular_without_reparse(self) -> bool {
        self.attributes & (FILE_ATTRIBUTE_DIRECTORY | FILE_ATTRIBUTE_REPARSE_POINT) == 0
    }
}

pub(super) fn query(file: &File) -> io::Result<HandleMetadata> {
    let mut information = BY_HANDLE_FILE_INFORMATION::default();
    // SAFETY: `file` owns a live Windows handle and `information` is a valid output buffer.
    let succeeded =
        unsafe { GetFileInformationByHandle(file.as_raw_handle() as HANDLE, &mut information) };
    if succeeded == 0 {
        return Err(io::Error::last_os_error());
    }
    Ok(HandleMetadata {
        identity: FileIdentity {
            volume_serial: information.dwVolumeSerialNumber,
            file_index: u64::from(information.nFileIndexHigh) << 32
                | u64::from(information.nFileIndexLow),
        },
        attributes: information.dwFileAttributes,
        size: u64::from(information.nFileSizeHigh) << 32 | u64::from(information.nFileSizeLow),
    })
}

pub(super) fn same_file(expected: &File, actual: &File) -> io::Result<bool> {
    Ok(query(expected)?.identity == query(actual)?.identity)
}

pub(super) fn open_absolute_regular(path: &Path, maximum_bytes: u64) -> Result<File, BackupError> {
    let (mut directory, mut components) = windows_local_path::open_fixed_drive_root(path)
        .map_err(|_| BackupError::path_unavailable())?;
    if !query(&directory)
        .map_err(|_| BackupError::path_unavailable())?
        .is_directory_without_reparse()
    {
        return Err(BackupError::path_unavailable());
    }
    let name = components.pop().ok_or_else(BackupError::path_unavailable)?;
    for component in components {
        directory = windows_handle::open_relative(
            &directory,
            &component,
            FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            share_all(),
            FILE_OPEN,
            FILE_DIRECTORY_FILE,
        )
        .map_err(|_| BackupError::path_unavailable())?;
        if !query(&directory)
            .map_err(|_| BackupError::path_unavailable())?
            .is_directory_without_reparse()
        {
            return Err(BackupError::path_unavailable());
        }
    }
    let file = windows_handle::open_relative(
        &directory,
        &name,
        FILE_GENERIC_READ,
        share_all(),
        FILE_OPEN,
        FILE_NON_DIRECTORY_FILE,
    )
    .map_err(|_| BackupError::path_unavailable())?;
    let metadata = query(&file).map_err(|_| BackupError::path_unavailable())?;
    if !metadata.is_regular_without_reparse() {
        return Err(BackupError::path_unavailable());
    }
    windows_local_path::ensure_ntfs(&file, false).map_err(|_| BackupError::path_unavailable())?;
    if metadata.size > maximum_bytes {
        return Err(BackupError::archive_too_large());
    }
    Ok(file)
}

fn share_all() -> u32 {
    FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE
}
