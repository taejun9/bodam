use std::fs::{self, File, OpenOptions};
use std::io::Write;
use std::path::{Path, PathBuf};

use uuid::Uuid;

use super::export_error::ContractExportError;
use super::export_model::{ContractExportFormat, ContractExportRow};
use super::export_verify::verify_generated_cells;

pub(super) fn save_verified_export(
    target: &Path,
    format: ContractExportFormat,
    rows: &[ContractExportRow],
    bytes: &[u8],
) -> Result<String, ContractExportError> {
    let basename = validate_target(target, format)?;
    let parent = target.parent().ok_or_else(invalid_save_path)?;
    let temporary = temporary_path(parent, format);
    let mut guard = TemporaryFile::create(temporary)?;
    guard.write_and_sync(bytes)?;
    let persisted = fs::read(guard.path()).map_err(|_| save_failed())?;
    if persisted != bytes {
        return Err(ContractExportError::verification_failed());
    }
    verify_generated_cells(format, rows, &persisted)?;
    replace_target(guard.path(), target).map_err(|_| save_failed())?;
    guard.keep();
    sync_parent_best_effort(parent);
    Ok(basename)
}

fn validate_target(
    target: &Path,
    format: ContractExportFormat,
) -> Result<String, ContractExportError> {
    if !target.is_absolute()
        || target
            .extension()
            .and_then(|value| value.to_str())
            .is_none_or(|value| !value.eq_ignore_ascii_case(format.extension()))
    {
        return Err(invalid_save_path());
    }
    let basename = target
        .file_name()
        .and_then(|value| value.to_str())
        .filter(|value| !value.is_empty())
        .ok_or_else(invalid_save_path)?;
    if basename.encode_utf16().count() > 255
        || basename.chars().any(|character| {
            let code_point = character as u32;
            code_point < 32 || code_point == 127
        })
    {
        return Err(invalid_save_path());
    }
    let parent = target.parent().ok_or_else(invalid_save_path)?;
    let parent_metadata = fs::metadata(parent).map_err(|_| invalid_save_path())?;
    if !parent_metadata.is_dir() {
        return Err(invalid_save_path());
    }
    match fs::symlink_metadata(target) {
        Ok(metadata) if metadata.is_file() && !metadata.file_type().is_symlink() => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        _ => return Err(invalid_save_path()),
    }
    Ok(basename.to_owned())
}

fn temporary_path(parent: &Path, format: ContractExportFormat) -> PathBuf {
    parent.join(format!(
        ".bodam-export-{}.tmp.{}",
        Uuid::new_v4(),
        format.extension()
    ))
}

struct TemporaryFile {
    path: PathBuf,
    file: Option<File>,
    remove_on_drop: bool,
}

impl TemporaryFile {
    fn create(path: PathBuf) -> Result<Self, ContractExportError> {
        let mut options = OpenOptions::new();
        options.write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;

            options.mode(0o600);
        }
        let file = options.open(&path).map_err(|_| save_failed())?;
        Ok(Self {
            path,
            file: Some(file),
            remove_on_drop: true,
        })
    }

    fn path(&self) -> &Path {
        &self.path
    }

    fn write_and_sync(&mut self, bytes: &[u8]) -> Result<(), ContractExportError> {
        let file = self.file.as_mut().ok_or_else(save_failed)?;
        file.write_all(bytes).map_err(|_| save_failed())?;
        file.flush().map_err(|_| save_failed())?;
        file.sync_all().map_err(|_| save_failed())?;
        self.file.take();
        Ok(())
    }

    fn keep(&mut self) {
        self.remove_on_drop = false;
    }
}

impl Drop for TemporaryFile {
    fn drop(&mut self) {
        if self.remove_on_drop {
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[cfg(not(windows))]
fn replace_target(source: &Path, target: &Path) -> std::io::Result<()> {
    fs::rename(source, target)
}

#[cfg(windows)]
fn replace_target(source: &Path, target: &Path) -> std::io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x0000_0001;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x0000_0008;
    #[link(name = "Kernel32")]
    unsafe extern "system" {
        fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
    }
    let source = source
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect::<Vec<_>>();
    // SAFETY: Both pointers reference NUL-terminated UTF-16 buffers for this call.
    let replaced = unsafe {
        MoveFileExW(
            source.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    (replaced != 0)
        .then_some(())
        .ok_or_else(std::io::Error::last_os_error)
}

#[cfg(unix)]
fn sync_parent_best_effort(parent: &Path) {
    if let Ok(directory) = File::open(parent) {
        let _ = directory.sync_all();
    }
}

#[cfg(not(unix))]
fn sync_parent_best_effort(_: &Path) {}

fn invalid_save_path() -> ContractExportError {
    ContractExportError::new(
        "EXPORT_PATH_INVALID",
        "선택한 저장 위치와 파일 확장자를 확인해 주세요.",
    )
}

fn save_failed() -> ContractExportError {
    ContractExportError::new(
        "EXPORT_SAVE_FAILED",
        "계약 파일을 안전하게 저장하지 못했습니다.",
    )
}

#[cfg(test)]
#[path = "export_save_tests.rs"]
mod tests;
