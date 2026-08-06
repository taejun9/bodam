use super::constants::{MAX_ARCHIVE_ENTRIES, MAX_ARCHIVE_ENTRY_BYTES, MAX_ARCHIVE_TOTAL_BYTES};
use super::error::ImportFileError;
use super::xlsx_resources::{normalized_archive_name, preflight_shared_string_tables};
use super::xlsx_shared_references::preflight_shared_string_references;
use std::collections::HashSet;
use std::io::{Cursor, Read};
use zip::ZipArchive;

const ARCHIVE_READ_CHUNK_BYTES: usize = 64 * 1024;

pub(crate) fn preflight_xlsx(bytes: &[u8]) -> Result<(), ImportFileError> {
    if !bytes.starts_with(b"PK\x03\x04") {
        return Err(ImportFileError::new(
            "XLSX_SIGNATURE_INVALID",
            "올바른 XLSX 파일이 아닙니다.",
        ));
    }

    let mut archive = ZipArchive::new(Cursor::new(bytes)).map_err(|_| archive_invalid())?;
    if archive.len() > MAX_ARCHIVE_ENTRIES {
        return Err(ImportFileError::new(
            "XLSX_ARCHIVE_ENTRY_LIMIT",
            "XLSX 내부 파일 수가 허용 범위를 초과했습니다.",
        ));
    }
    if archive
        .has_overlapping_files()
        .map_err(|_| archive_invalid())?
    {
        return Err(unsafe_archive());
    }

    let mut declared_total_size = 0_u64;
    let mut actual_total_size = 0_u64;
    let mut required = [false; 3];
    let mut names = HashSet::with_capacity(archive.len());
    let mut normalized_names = HashSet::with_capacity(archive.len());
    let mut size_mismatch = false;
    for index in 0..archive.len() {
        let mut file = archive.by_index(index).map_err(|_| archive_invalid())?;
        if file.encrypted()
            || file.is_symlink()
            || file.enclosed_name().is_none()
            || file.compressed_size() > bytes.len() as u64
        {
            return Err(unsafe_archive());
        }
        if !names.insert(file.name().to_owned())
            || !normalized_names.insert(normalized_archive_name(file.name()))
        {
            return Err(unsafe_archive());
        }
        if file.size() > MAX_ARCHIVE_ENTRY_BYTES {
            return Err(entry_too_large());
        }
        declared_total_size = declared_total_size
            .checked_add(file.size())
            .ok_or_else(total_too_large)?;
        if declared_total_size > MAX_ARCHIVE_TOTAL_BYTES {
            return Err(total_too_large());
        }

        match file.name() {
            "[Content_Types].xml" => required[0] = true,
            "_rels/.rels" => required[1] = true,
            "xl/workbook.xml" => required[2] = true,
            _ => {}
        }
        let declared_size = file.size();
        let actual_size = read_actual_entry_size(&mut file, &mut actual_total_size)?;
        if actual_size != declared_size {
            size_mismatch = true;
        }
    }

    if required.iter().any(|present| !present) {
        return Err(ImportFileError::new(
            "XLSX_STRUCTURE_INVALID",
            "XLSX 내부 구조를 확인할 수 없습니다.",
        ));
    }
    if size_mismatch {
        return Err(unsafe_archive());
    }
    preflight_shared_string_tables(&mut archive)?;
    preflight_shared_string_references(&mut archive)?;
    Ok(())
}

fn read_actual_entry_size<R: Read>(
    reader: &mut R,
    actual_total_size: &mut u64,
) -> Result<u64, ImportFileError> {
    let mut buffer = [0_u8; ARCHIVE_READ_CHUNK_BYTES];
    let mut actual_entry_size = 0_u64;
    loop {
        let read = reader.read(&mut buffer).map_err(|_| archive_invalid())?;
        if read == 0 {
            return Ok(actual_entry_size);
        }
        let read = read as u64;
        actual_entry_size = actual_entry_size
            .checked_add(read)
            .ok_or_else(entry_too_large)?;
        if actual_entry_size > MAX_ARCHIVE_ENTRY_BYTES {
            return Err(entry_too_large());
        }
        *actual_total_size = actual_total_size
            .checked_add(read)
            .ok_or_else(total_too_large)?;
        if *actual_total_size > MAX_ARCHIVE_TOTAL_BYTES {
            return Err(total_too_large());
        }
    }
}

fn archive_invalid() -> ImportFileError {
    ImportFileError::new("XLSX_ARCHIVE_INVALID", "XLSX 압축 구조를 읽을 수 없습니다.")
}

fn entry_too_large() -> ImportFileError {
    ImportFileError::new(
        "XLSX_ARCHIVE_ENTRY_TOO_LARGE",
        "XLSX 내부 파일 하나의 크기가 허용 범위를 초과했습니다.",
    )
}

fn total_too_large() -> ImportFileError {
    ImportFileError::new(
        "XLSX_ARCHIVE_TOTAL_TOO_LARGE",
        "XLSX 압축 해제 크기가 허용 범위를 초과했습니다.",
    )
}

fn unsafe_archive() -> ImportFileError {
    ImportFileError::new("XLSX_ARCHIVE_UNSAFE", "안전하지 않은 XLSX 압축 구조입니다.")
}
