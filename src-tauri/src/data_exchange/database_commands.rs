use std::sync::Arc;

use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::commit_model::{ImportCommitRequest, ImportCommitResult};
use super::context::{ImportContextQuery, ImportContextSnapshot};

#[tauri::command]
pub(crate) async fn load_contract_import_context(
    query: ImportContextQuery,
    state: State<'_, AppState>,
) -> Result<ImportContextSnapshot, AppError> {
    let repository = Arc::clone(&state.data_exchange);
    tauri::async_runtime::spawn_blocking(move || repository.context(query))
        .await
        .map_err(|_| AppError::StateUnavailable)?
}

#[tauri::command]
pub(crate) async fn commit_contract_import(
    request: ImportCommitRequest,
    state: State<'_, AppState>,
) -> Result<ImportCommitResult, AppError> {
    let repository = Arc::clone(&state.data_exchange);
    tauri::async_runtime::spawn_blocking(move || repository.commit(request))
        .await
        .map_err(|_| AppError::StateUnavailable)?
}
