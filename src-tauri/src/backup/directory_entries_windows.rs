use std::fs::File;
use std::io;
use std::mem;
use std::os::windows::io::AsRawHandle;
use std::slice;
use std::sync::Mutex;

use windows_sys::Win32::Foundation::{ERROR_HANDLE_EOF, ERROR_NO_MORE_FILES, HANDLE};
use windows_sys::Win32::Storage::FileSystem::{
    FileIdBothDirectoryInfo, FileIdBothDirectoryRestartInfo, GetFileInformationByHandleEx,
    FILE_ID_BOTH_DIR_INFO,
};

const BUFFER_BYTES: usize = 64 * 1024;
const MAX_BATCHES: usize = 4_096;

pub(super) fn list(directory: &File, scan: &Mutex<()>) -> io::Result<Vec<String>> {
    let _scan = scan
        .lock()
        .map_err(|_| io::Error::other("backup directory scan unavailable"))?;
    let mut buffer = vec![0_u64; BUFFER_BYTES / mem::size_of::<u64>()];
    let mut names = Vec::new();
    for batch in 0..MAX_BATCHES {
        let class = if batch == 0 {
            FileIdBothDirectoryRestartInfo
        } else {
            FileIdBothDirectoryInfo
        };
        // SAFETY: the directory handle is live, scans are serialized, and the aligned buffer is
        // writable for its full reported size.
        let succeeded = unsafe {
            GetFileInformationByHandleEx(
                directory.as_raw_handle() as HANDLE,
                class,
                buffer.as_mut_ptr().cast(),
                u32::try_from(BUFFER_BYTES).expect("fixed directory buffer fits u32"),
            )
        };
        if succeeded == 0 {
            let error = io::Error::last_os_error();
            if matches!(
                error.raw_os_error().map(|value| value as u32),
                Some(code) if code == ERROR_NO_MORE_FILES || code == ERROR_HANDLE_EOF
            ) {
                return Ok(names);
            }
            return Err(error);
        }
        parse_batch(&buffer, &mut names)?;
    }
    Err(io::Error::other("backup directory scan limit exceeded"))
}

fn parse_batch(buffer: &[u64], names: &mut Vec<String>) -> io::Result<()> {
    let bytes = buffer.len() * mem::size_of::<u64>();
    let name_offset = mem::offset_of!(FILE_ID_BOTH_DIR_INFO, FileName);
    let mut offset = 0_usize;
    loop {
        let record_end = offset
            .checked_add(mem::size_of::<FILE_ID_BOTH_DIR_INFO>())
            .filter(|end| *end <= bytes)
            .ok_or_else(invalid_data)?;
        // SAFETY: the full projected fixed header is within the aligned backing allocation;
        // unaligned read also covers offsets returned by the filesystem defensively.
        let record = unsafe {
            buffer
                .as_ptr()
                .cast::<u8>()
                .add(offset)
                .cast::<FILE_ID_BOTH_DIR_INFO>()
                .read_unaligned()
        };
        let name_bytes = usize::try_from(record.FileNameLength).map_err(|_| invalid_data())?;
        if name_bytes % 2 != 0 {
            return Err(invalid_data());
        }
        let name_start = offset.checked_add(name_offset).ok_or_else(invalid_data)?;
        let _name_end = name_start
            .checked_add(name_bytes)
            .filter(|end| *end <= bytes)
            .ok_or_else(invalid_data)?;
        // SAFETY: the bounds and UTF-16 alignment relative to the u64 allocation were checked.
        let wide = unsafe {
            slice::from_raw_parts(
                buffer.as_ptr().cast::<u8>().add(name_start).cast::<u16>(),
                name_bytes / 2,
            )
        };
        if let Ok(name) = String::from_utf16(wide) {
            if name != "." && name != ".." {
                names.push(name);
            }
        }
        if record.NextEntryOffset == 0 {
            return Ok(());
        }
        let next = usize::try_from(record.NextEntryOffset).map_err(|_| invalid_data())?;
        if next < record_end - offset || next % 4 != 0 {
            return Err(invalid_data());
        }
        offset = offset
            .checked_add(next)
            .filter(|next_offset| *next_offset < bytes)
            .ok_or_else(invalid_data)?;
    }
}

fn invalid_data() -> io::Error {
    io::Error::new(io::ErrorKind::InvalidData, "invalid backup directory entry")
}

#[cfg(test)]
mod tests {
    use super::{invalid_data, parse_batch};

    #[test]
    fn empty_projection_buffer_is_rejected() {
        let mut names = Vec::new();
        assert_eq!(
            parse_batch(&[], &mut names).unwrap_err().kind(),
            invalid_data().kind()
        );
    }
}
