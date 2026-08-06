use std::path::PathBuf;
use std::sync::Arc;

use chrono::Local;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

use crate::AppState;

use super::constants::MAX_DATA_ROWS;
use super::export_csv::build_csv;
use super::export_error::ContractExportError;
use super::export_model::{
    ContractExportFormat, ContractExportResult, ContractExportSnapshot, ContractExportSummary,
};
use super::export_save::save_verified_export;
use super::export_xlsx::build_xlsx;

#[tauri::command]
pub(crate) async fn load_contract_export_summary(
    state: State<'_, AppState>,
) -> Result<ContractExportSummary, ContractExportError> {
    let repository = Arc::clone(&state.data_exchange);
    tauri::async_runtime::spawn_blocking(move || {
        let snapshot = repository.export_snapshot()?;
        summary(&snapshot)
    })
    .await
    .map_err(|_| worker_unavailable())?
}

#[tauri::command]
pub(crate) async fn save_contract_export(
    format: ContractExportFormat,
    app: AppHandle,
    state: State<'_, AppState>,
) -> Result<Option<ContractExportResult>, ContractExportError> {
    let repository = Arc::clone(&state.data_exchange);
    tauri::async_runtime::spawn_blocking(move || save_export(repository, app, format))
        .await
        .map_err(|_| worker_unavailable())?
}

fn save_export(
    repository: Arc<super::DataExchangeRepository>,
    app: AppHandle,
    format: ContractExportFormat,
) -> Result<Option<ContractExportResult>, ContractExportError> {
    let snapshot = repository.export_snapshot()?;
    validate_export_limits(
        snapshot.exportable_count,
        snapshot.generation_limit_exceeded,
    )?;
    let bytes = match format {
        ContractExportFormat::Xlsx => build_xlsx(&snapshot.rows)?,
        ContractExportFormat::Csv => build_csv(&snapshot.rows)?,
    };
    let Some(target) = choose_export_path(&app, format)? else {
        return Ok(None);
    };
    let basename = save_verified_export(&target, format, &snapshot.rows, &bytes)?;
    Ok(Some(ContractExportResult {
        basename,
        format,
        exported_count: snapshot.exportable_count,
        missing_source_count: snapshot.missing_source_count,
        conflict_count: snapshot.conflict_count,
    }))
}

fn summary(
    snapshot: &ContractExportSnapshot,
) -> Result<ContractExportSummary, ContractExportError> {
    Ok(ContractExportSummary {
        exportable_count: snapshot.exportable_count,
        missing_source_count: snapshot.missing_source_count,
        conflict_count: snapshot.conflict_count,
        csv_allowed: snapshot.csv_allowed,
    })
}

fn validate_export_limits(
    count: u32,
    generation_limit_exceeded: bool,
) -> Result<(), ContractExportError> {
    if count == 0 {
        return Err(ContractExportError::new(
            "EXPORT_NO_DATA",
            "내보낼 수 있는 계약 원본이 없습니다.",
        ));
    }
    if count > MAX_DATA_ROWS as u32 {
        return Err(ContractExportError::new(
            "EXPORT_ROW_LIMIT_EXCEEDED",
            "한 번에 내보낼 계약은 5,000개 이하여야 합니다.",
        ));
    }
    if generation_limit_exceeded {
        return Err(ContractExportError::logical_text_too_large());
    }
    Ok(())
}

fn choose_native_export_path(
    app: &AppHandle,
    format: ContractExportFormat,
) -> Result<Option<PathBuf>, ContractExportError> {
    let extension = format.extension();
    let filename = format!(
        "BODAM-contracts-{}.{}",
        Local::now().format("%Y%m%d-%H%M%S"),
        extension
    );
    let selected = app
        .dialog()
        .file()
        .set_title("계약조회 파일 저장")
        .set_file_name(filename)
        .add_filter(extension.to_uppercase(), &[extension])
        .blocking_save_file();
    selected
        .map(|path| {
            path.into_path().map_err(|_| {
                ContractExportError::new(
                    "EXPORT_PATH_INVALID",
                    "선택한 저장 위치와 파일 확장자를 확인해 주세요.",
                )
            })
        })
        .transpose()
}

#[cfg(not(feature = "e2e"))]
fn choose_export_path(
    app: &AppHandle,
    format: ContractExportFormat,
) -> Result<Option<PathBuf>, ContractExportError> {
    choose_native_export_path(app, format)
}

#[cfg(feature = "e2e")]
fn choose_export_path(
    app: &AppHandle,
    format: ContractExportFormat,
) -> Result<Option<PathBuf>, ContractExportError> {
    if super::commands::e2e::native_dialog_enabled(
        std::env::var_os("BODAM_E2E_NATIVE_DIALOG").as_deref(),
    ) {
        return choose_native_export_path(app, format);
    }
    crate::e2e_paths::validate_export_path(
        std::env::var_os("BODAM_E2E_EXPORT_PATH"),
        std::env::var_os("BODAM_E2E_DB_PATH"),
        format.extension(),
    )
    .map(Some)
    .map_err(|_| {
        ContractExportError::new(
            "E2E_EXPORT_PATH_INVALID",
            "E2E 내보내기 파일 구성을 확인할 수 없습니다.",
        )
    })
}

fn worker_unavailable() -> ContractExportError {
    ContractExportError::new(
        "EXPORT_WORKER_UNAVAILABLE",
        "파일 저장 작업을 완료할 수 없습니다.",
    )
}

#[cfg(test)]
mod tests {
    use super::validate_export_limits;

    #[test]
    fn rejects_zero_and_over_five_thousand_before_opening_a_dialog() {
        assert_eq!(
            validate_export_limits(0, false).unwrap_err().code,
            "EXPORT_NO_DATA"
        );
        assert!(validate_export_limits(1, false).is_ok());
        assert!(validate_export_limits(5_000, false).is_ok());
        assert_eq!(
            validate_export_limits(5_001, false).unwrap_err().code,
            "EXPORT_ROW_LIMIT_EXCEEDED"
        );
        assert_eq!(
            validate_export_limits(1, true).unwrap_err().code,
            "EXPORT_LOGICAL_TEXT_LIMIT_EXCEEDED"
        );
    }
}
