use std::ffi::OsString;
use std::fs::File;
use std::io;
use std::os::windows::ffi::OsStrExt;
use std::os::windows::io::{AsRawHandle, FromRawHandle};
use std::path::{Component, Path, Prefix};
use std::ptr;

use windows_sys::Win32::Foundation::{HANDLE, INVALID_HANDLE_VALUE};
use windows_sys::Win32::Storage::FileSystem::{
    CreateFileW, GetDriveTypeW, GetVolumeInformationByHandleW, FILE_ATTRIBUTE_NORMAL,
    FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_LIST_DIRECTORY,
    FILE_READ_ATTRIBUTES, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE, OPEN_EXISTING,
    SYNCHRONIZE,
};
use windows_sys::Win32::System::SystemServices::FILE_READ_ONLY_VOLUME;
use windows_sys::Win32::System::WindowsProgramming::DRIVE_FIXED;

pub(super) fn open_fixed_drive_root(path: &Path) -> io::Result<(File, Vec<OsString>)> {
    let (root, components) = split_drive_path(path)?;
    // SAFETY: `root` is a NUL-terminated drive-root buffer.
    if unsafe { GetDriveTypeW(root.as_ptr()) } != DRIVE_FIXED {
        return Err(unavailable());
    }
    // SAFETY: the root buffer and pointer arguments satisfy CreateFileW.
    let handle = unsafe {
        CreateFileW(
            root.as_ptr(),
            FILE_LIST_DIRECTORY | FILE_READ_ATTRIBUTES | SYNCHRONIZE,
            FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE,
            ptr::null(),
            OPEN_EXISTING,
            FILE_ATTRIBUTE_NORMAL | FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT,
            ptr::null_mut(),
        )
    };
    if handle == INVALID_HANDLE_VALUE {
        return Err(io::Error::last_os_error());
    }
    // SAFETY: the successful CreateFileW handle is uniquely transferred into `File`.
    Ok((unsafe { File::from_raw_handle(handle) }, components))
}

pub(super) fn ensure_ntfs(file: &File, require_writable: bool) -> io::Result<()> {
    let mut flags = 0_u32;
    let mut filesystem = [0_u16; 32];
    // SAFETY: the handle is live and all optional/output pointers match their buffer sizes.
    let succeeded = unsafe {
        GetVolumeInformationByHandleW(
            file.as_raw_handle() as HANDLE,
            ptr::null_mut(),
            0,
            ptr::null_mut(),
            ptr::null_mut(),
            &mut flags,
            filesystem.as_mut_ptr(),
            filesystem.len() as u32,
        )
    };
    if succeeded == 0 || require_writable && flags & FILE_READ_ONLY_VOLUME != 0 {
        return Err(unavailable());
    }
    let end = filesystem
        .iter()
        .position(|value| *value == 0)
        .unwrap_or(filesystem.len());
    let name = String::from_utf16(&filesystem[..end]).map_err(|_| unavailable())?;
    name.eq_ignore_ascii_case("NTFS")
        .then_some(())
        .ok_or_else(unavailable)
}

fn split_drive_path(path: &Path) -> io::Result<(Vec<u16>, Vec<OsString>)> {
    if !path.is_absolute() {
        return Err(unavailable());
    }
    let mut parts = path.components();
    let drive = match parts.next() {
        Some(Component::Prefix(prefix)) => match prefix.kind() {
            Prefix::Disk(drive) | Prefix::VerbatimDisk(drive) => drive,
            _ => return Err(unavailable()),
        },
        _ => return Err(unavailable()),
    };
    if !matches!(parts.next(), Some(Component::RootDir)) {
        return Err(unavailable());
    }
    let mut components = Vec::new();
    for part in parts {
        match part {
            Component::Normal(value) if is_safe_component(value) => {
                components.push(value.to_owned());
            }
            _ => return Err(unavailable()),
        }
    }
    Ok((
        vec![u16::from(drive), b':' as u16, b'\\' as u16, 0],
        components,
    ))
}

fn is_safe_component(value: &std::ffi::OsStr) -> bool {
    let wide = value.encode_wide().collect::<Vec<_>>();
    !wide.is_empty()
        && wide.len() <= 255
        && !wide.contains(&0)
        && wide.as_slice() != [b'.' as u16]
        && wide.as_slice() != [b'.' as u16, b'.' as u16]
        && !wide.ends_with(&[b'.' as u16])
        && !wide.ends_with(&[b' ' as u16])
        && !wide.iter().any(|character| *character < 32)
        && !wide
            .iter()
            .any(|character| matches!(*character, 34 | 42 | 58 | 60 | 62 | 63 | 124))
}

fn unavailable() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidInput, "backup path unavailable")
}

#[cfg(test)]
mod tests {
    use std::ffi::OsStr;

    use super::is_safe_component;

    #[test]
    fn dot_parent_and_control_components_are_rejected() {
        assert!(!is_safe_component(OsStr::new(".")));
        assert!(!is_safe_component(OsStr::new("..")));
        assert!(!is_safe_component(OsStr::new("bad\u{1f}name")));
        assert!(is_safe_component(OsStr::new("백업")));
    }
}
