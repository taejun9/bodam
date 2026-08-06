use super::constants::{FIELD_KEYS, HEADERS, MAX_CELL_SCALARS, MAX_FILE_BYTES};
use super::csv_parser::parse_csv;
use super::error::ImportFileError;
use super::model::{ImportFileFormat, ParsedImportFile};
use super::xlsx_parser::parse_xlsx;
use std::fs::File;
use std::io::{Read, Take};
use std::path::Path;
use unicode_normalization::UnicodeNormalization;

pub(crate) fn parse_import_path(path: &Path) -> Result<ParsedImportFile, ImportFileError> {
    let basename = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| {
            ImportFileError::new(
                "FILE_NAME_UNAVAILABLE",
                "선택한 파일 이름을 읽을 수 없습니다.",
            )
        })?
        .to_owned();
    validate_basename(&basename)?;
    let _format = format_for_basename(&basename)?;

    let file = File::open(path).map_err(|_| file_unavailable())?;
    let metadata = file.metadata().map_err(|_| file_unavailable())?;
    if !metadata.is_file() {
        return Err(file_unavailable());
    }
    if metadata.len() > MAX_FILE_BYTES {
        return Err(file_too_large());
    }

    let mut bytes = Vec::with_capacity(metadata.len() as usize);
    let mut bounded: Take<File> = file.take(MAX_FILE_BYTES + 1);
    bounded
        .read_to_end(&mut bytes)
        .map_err(|_| file_unavailable())?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(file_too_large());
    }
    parse_import_bytes(&basename, &bytes)
}

pub(crate) fn parse_import_bytes(
    basename: &str,
    bytes: &[u8],
) -> Result<ParsedImportFile, ImportFileError> {
    validate_basename(basename)?;
    if bytes.len() as u64 > MAX_FILE_BYTES {
        return Err(file_too_large());
    }

    match format_for_basename(basename)? {
        ImportFileFormat::Xlsx => parse_xlsx(basename.to_owned(), bytes),
        ImportFileFormat::Csv => parse_csv(basename.to_owned(), bytes),
    }
}

fn validate_basename(basename: &str) -> Result<(), ImportFileError> {
    if basename.is_empty()
        || basename.encode_utf16().count() > 255
        || basename
            .chars()
            .any(|character| matches!(character, '/' | '\\' | '\0'))
    {
        Err(ImportFileError::new(
            "FILE_NAME_UNAVAILABLE",
            "선택한 파일 이름을 읽을 수 없습니다.",
        ))
    } else {
        Ok(())
    }
}

pub(crate) fn validate_header_cell(
    index: usize,
    actual: Option<&str>,
) -> Result<(), ImportFileError> {
    let matches = actual
        .map(|value| value.nfc().eq(HEADERS[index].nfc()))
        .unwrap_or(false);
    if matches {
        Ok(())
    } else {
        Err(ImportFileError::at(
            "HEADER_INVALID",
            "21개 헤더의 표기와 순서를 확인해 주세요.",
            1,
            FIELD_KEYS[index],
        ))
    }
}

pub(crate) fn validate_cell_length(
    value: &str,
    source_row: u32,
    index: usize,
) -> Result<(), ImportFileError> {
    if value.chars().count() <= MAX_CELL_SCALARS {
        Ok(())
    } else {
        Err(ImportFileError::at(
            "CELL_TOO_LONG",
            "셀 텍스트 길이가 허용 범위를 초과했습니다.",
            source_row,
            FIELD_KEYS[index],
        ))
    }
}

fn format_for_basename(basename: &str) -> Result<ImportFileFormat, ImportFileError> {
    match basename.rsplit_once('.').map(|(_, extension)| extension) {
        Some(extension) if extension.eq_ignore_ascii_case("xlsx") => Ok(ImportFileFormat::Xlsx),
        Some(extension) if extension.eq_ignore_ascii_case("csv") => Ok(ImportFileFormat::Csv),
        _ => Err(ImportFileError::new(
            "UNSUPPORTED_FILE_FORMAT",
            "XLSX 또는 CSV 파일만 선택할 수 있습니다.",
        )),
    }
}

fn file_unavailable() -> ImportFileError {
    ImportFileError::new(
        "FILE_UNAVAILABLE",
        "선택한 파일을 안전하게 읽을 수 없습니다.",
    )
}

fn file_too_large() -> ImportFileError {
    ImportFileError::new("FILE_TOO_LARGE", "파일 크기는 10 MiB 이하여야 합니다.")
}
