use std::ffi::OsStr;
use std::fs::File;
use std::io;
use std::mem::{self, MaybeUninit};
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::ptr;

use windows_sys::Wdk::Foundation::OBJECT_ATTRIBUTES;
use windows_sys::Wdk::Storage::FileSystem::{
    NtCreateFile, FILE_OPEN_REPARSE_POINT, FILE_SYNCHRONOUS_IO_NONALERT,
    NTCREATEFILE_CREATE_DISPOSITION, NTCREATEFILE_CREATE_OPTIONS,
};
use windows_sys::Win32::Foundation::{
    RtlNtStatusToDosError, HANDLE, INVALID_HANDLE_VALUE, OBJ_CASE_INSENSITIVE, UNICODE_STRING,
};
use windows_sys::Win32::Storage::FileSystem::{
    FileDispositionInfo, FileRenameInfo, FlushFileBuffers, SetFileInformationByHandle,
    FILE_ACCESS_RIGHTS, FILE_ATTRIBUTE_NORMAL, FILE_DISPOSITION_INFO, FILE_RENAME_INFO,
    FILE_SHARE_MODE,
};
use windows_sys::Win32::System::IO::IO_STATUS_BLOCK;

pub(super) fn open_relative(
    directory: &File,
    name: &OsStr,
    desired_access: FILE_ACCESS_RIGHTS,
    share_access: FILE_SHARE_MODE,
    disposition: NTCREATEFILE_CREATE_DISPOSITION,
    options: NTCREATEFILE_CREATE_OPTIONS,
) -> io::Result<File> {
    let mut name = wide_name(name)?;
    let byte_length = u16::try_from(name.len().checked_mul(2).ok_or_else(invalid_input)?)
        .map_err(|_| invalid_input())?;
    let unicode = UNICODE_STRING {
        Length: byte_length,
        MaximumLength: byte_length,
        Buffer: name.as_mut_ptr(),
    };
    let attributes = OBJECT_ATTRIBUTES {
        Length: u32::try_from(mem::size_of::<OBJECT_ATTRIBUTES>()).map_err(|_| invalid_input())?,
        RootDirectory: raw_handle(directory),
        ObjectName: &unicode,
        Attributes: OBJ_CASE_INSENSITIVE,
        SecurityDescriptor: ptr::null(),
        SecurityQualityOfService: ptr::null(),
    };
    let mut status_block = IO_STATUS_BLOCK::default();
    let mut handle: HANDLE = ptr::null_mut();
    // SAFETY: all input structures and buffers live through the call; the returned handle is
    // checked and transferred exactly once to `File`.
    let status = unsafe {
        NtCreateFile(
            &mut handle,
            desired_access,
            &attributes,
            &mut status_block,
            ptr::null(),
            FILE_ATTRIBUTE_NORMAL,
            share_access,
            disposition,
            options | FILE_OPEN_REPARSE_POINT | FILE_SYNCHRONOUS_IO_NONALERT,
            ptr::null(),
            0,
        )
    };
    if status < 0 || handle.is_null() || handle == INVALID_HANDLE_VALUE {
        return Err(ntstatus_error(status));
    }
    // SAFETY: the successful NtCreateFile handle is uniquely transferred into `File`.
    Ok(unsafe { File::from_raw_handle(handle) })
}

pub(super) fn rename_relative(source: &File, directory: &File, target: &str) -> io::Result<()> {
    let target = wide_name(OsStr::new(target))?;
    let name_bytes = target.len().checked_mul(2).ok_or_else(invalid_input)?;
    let name_offset = mem::offset_of!(FILE_RENAME_INFO, FileName);
    let buffer_bytes = mem::size_of::<FILE_RENAME_INFO>()
        .checked_add(name_bytes)
        .ok_or_else(invalid_input)?;
    let words = buffer_bytes
        .checked_add(mem::size_of::<u64>() - 1)
        .ok_or_else(invalid_input)?
        / mem::size_of::<u64>();
    let mut buffer = vec![MaybeUninit::<u64>::zeroed(); words];
    let information = buffer.as_mut_ptr().cast::<FILE_RENAME_INFO>();
    // SAFETY: the allocation is sufficiently large/aligned for the projected structure and
    // UTF-16 tail. Every field read by SetFileInformationByHandle is initialized here.
    unsafe {
        information.write(FILE_RENAME_INFO::default());
        (*information).Anonymous.ReplaceIfExists = true;
        (*information).RootDirectory = raw_handle(directory);
        (*information).FileNameLength = u32::try_from(name_bytes).map_err(|_| invalid_input())?;
        ptr::copy_nonoverlapping(
            target.as_ptr(),
            information.cast::<u8>().add(name_offset).cast::<u16>(),
            target.len(),
        );
    }
    let buffer_bytes = u32::try_from(buffer_bytes).map_err(|_| invalid_input())?;
    // SAFETY: `information` points at the initialized buffer described above.
    let succeeded = unsafe {
        SetFileInformationByHandle(
            raw_handle(source),
            FileRenameInfo,
            information.cast(),
            buffer_bytes,
        )
    };
    bool_result(succeeded)?;
    // SAFETY: the rename source remains a live writable file handle after the rename.
    let flushed = unsafe { FlushFileBuffers(raw_handle(source)) };
    bool_result(flushed)
}

pub(super) fn mark_delete(file: &File) -> io::Result<()> {
    let information = FILE_DISPOSITION_INFO { DeleteFile: true };
    // SAFETY: the live file handle has DELETE access and the projected structure is complete.
    let succeeded = unsafe {
        SetFileInformationByHandle(
            raw_handle(file),
            FileDispositionInfo,
            (&information as *const FILE_DISPOSITION_INFO).cast(),
            u32::try_from(mem::size_of_val(&information)).map_err(|_| invalid_input())?,
        )
    };
    bool_result(succeeded)
}

fn wide_name(name: &OsStr) -> io::Result<Vec<u16>> {
    let wide = name.encode_wide().collect::<Vec<_>>();
    if wide.is_empty() || wide.contains(&0) {
        return Err(invalid_input());
    }
    Ok(wide)
}

fn raw_handle(file: &File) -> HANDLE {
    file.as_raw_handle() as HANDLE
}

fn ntstatus_error(status: i32) -> io::Error {
    // SAFETY: RtlNtStatusToDosError accepts every NTSTATUS value.
    let code = unsafe { RtlNtStatusToDosError(status) };
    io::Error::from_raw_os_error(code as i32)
}

fn bool_result(value: i32) -> io::Result<()> {
    (value != 0)
        .then_some(())
        .ok_or_else(io::Error::last_os_error)
}

fn invalid_input() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, "invalid backup entry name")
}
