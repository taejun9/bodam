use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{AppSettingsView, UpdateAppSettingsInput};
use super::validation::validate_update;
use super::SettingsRepository;

#[tauri::command]
pub(crate) fn load_app_settings(state: State<'_, AppState>) -> Result<AppSettingsView, AppError> {
    load_with_repository(&state.settings)
}

#[tauri::command]
pub(crate) fn update_app_settings(
    input: UpdateAppSettingsInput,
    state: State<'_, AppState>,
) -> Result<AppSettingsView, AppError> {
    update_with_repository(&state.settings, input)
}

pub(super) fn load_with_repository(
    repository: &SettingsRepository,
) -> Result<AppSettingsView, AppError> {
    repository.load()?.to_view()
}

pub(super) fn update_with_repository(
    repository: &SettingsRepository,
    input: UpdateAppSettingsInput,
) -> Result<AppSettingsView, AppError> {
    repository.update(validate_update(input)?)?.to_view()
}
