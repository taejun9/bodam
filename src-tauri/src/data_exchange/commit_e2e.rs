use std::ffi::OsString;
use std::sync::atomic::{AtomicBool, Ordering};

use crate::error::AppError;

pub(super) static E2E_IMPORT_FAILURE_USED: AtomicBool = AtomicBool::new(false);

pub(super) fn e2e_import_failure_source_row(
    value: Option<OsString>,
) -> Result<Option<u32>, AppError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.to_str().ok_or(AppError::ImportConflict)?;
    if value.is_empty()
        || value.starts_with('0')
        || !value.bytes().all(|byte| byte.is_ascii_digit())
    {
        return Err(AppError::ImportConflict);
    }
    let source_row = value.parse::<u32>().map_err(|_| AppError::ImportConflict)?;
    (source_row >= 2)
        .then_some(Some(source_row))
        .ok_or(AppError::ImportConflict)
}

pub(super) fn fail_e2e_import_once(target: Option<u32>, source_row: u32) -> Result<(), AppError> {
    if target == Some(source_row) && !E2E_IMPORT_FAILURE_USED.swap(true, Ordering::SeqCst) {
        Err(AppError::ImportConflict)
    } else {
        Ok(())
    }
}
