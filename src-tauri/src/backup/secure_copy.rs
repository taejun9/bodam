use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

#[cfg(any(target_os = "macos", target_os = "linux"))]
use rustix::fs::{self as unix_fs, FileType, Mode, OFlags, CWD};

use super::file_ops::SecureFile;
use super::BackupError;

pub(super) fn copy_secure_bounded(
    source: &Path,
    destination: &Path,
    maximum_bytes: u64,
) -> Result<(), BackupError> {
    copy_secure_bounded_with(source, destination, maximum_bytes, || {})
}

fn copy_secure_bounded_with(
    source: &Path,
    destination: &Path,
    maximum_bytes: u64,
    before_open: impl FnOnce(),
) -> Result<(), BackupError> {
    if !source.is_absolute() {
        return Err(BackupError::path_unavailable());
    }
    before_open();
    let mut input = open_regular_source(source, maximum_bytes)?;
    let mut guard = SecureFile::create(destination)?;
    let output = guard.file_mut()?;
    let mut buffer = [0_u8; 64 * 1024];
    let mut total = 0_u64;
    loop {
        let read = input
            .read(&mut buffer)
            .map_err(|_| BackupError::save_failed())?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(BackupError::archive_too_large)?;
        if total > maximum_bytes {
            return Err(BackupError::archive_too_large());
        }
        output
            .write_all(&buffer[..read])
            .map_err(|_| BackupError::save_failed())?;
    }
    output.flush().map_err(|_| BackupError::save_failed())?;
    output.sync_all().map_err(|_| BackupError::save_failed())?;
    guard.close();
    guard.keep();
    Ok(())
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
fn open_regular_source(source: &Path, maximum_bytes: u64) -> Result<File, BackupError> {
    let descriptor = unix_fs::openat(
        CWD,
        source,
        OFlags::RDONLY | OFlags::CLOEXEC | OFlags::NOFOLLOW,
        Mode::empty(),
    )
    .map_err(|_| BackupError::path_unavailable())?;
    let stat = unix_fs::fstat(&descriptor).map_err(|_| BackupError::path_unavailable())?;
    if FileType::from_raw_mode(stat.st_mode) != FileType::RegularFile {
        return Err(BackupError::path_unavailable());
    }
    if stat.st_size < 0 || stat.st_size as u64 > maximum_bytes {
        return Err(BackupError::archive_too_large());
    }
    Ok(File::from(descriptor))
}

#[cfg(not(any(target_os = "macos", target_os = "linux")))]
fn open_regular_source(source: &Path, maximum_bytes: u64) -> Result<File, BackupError> {
    let metadata =
        std::fs::symlink_metadata(source).map_err(|_| BackupError::path_unavailable())?;
    if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(BackupError::path_unavailable());
    }
    let file = File::open(source).map_err(|_| BackupError::path_unavailable())?;
    let metadata = file
        .metadata()
        .map_err(|_| BackupError::path_unavailable())?;
    if !metadata.is_file() {
        return Err(BackupError::path_unavailable());
    }
    if metadata.len() > maximum_bytes {
        return Err(BackupError::archive_too_large());
    }
    Ok(file)
}

#[cfg(test)]
pub(super) fn copy_secure_bounded_with_pre_open_hook(
    source: &Path,
    destination: &Path,
    maximum_bytes: u64,
    before_open: impl FnOnce(),
) -> Result<(), BackupError> {
    copy_secure_bounded_with(source, destination, maximum_bytes, before_open)
}

#[cfg(test)]
#[path = "secure_copy_tests.rs"]
mod tests;
