use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{
    Coverage, CoverageCategory, CreateCoverageInput, DeletedCoverage, DeletedCoverageCategory,
    UpdateCoverageCategoryInput, UpdateCoverageInput,
};
use super::validation::{
    validate_category_id, validate_category_update, validate_coverage_id, validate_create,
    validate_customer_id, validate_policy_id, validate_update,
};

#[tauri::command]
pub(crate) fn list_coverage_categories(
    state: State<'_, AppState>,
) -> Result<Vec<CoverageCategory>, AppError> {
    state.coverages.list_categories()
}

#[tauri::command]
pub(crate) fn update_coverage_category(
    id: String,
    input: UpdateCoverageCategoryInput,
    state: State<'_, AppState>,
) -> Result<CoverageCategory, AppError> {
    let id = validate_category_id(id)?;
    state
        .coverages
        .update_category(&id, validate_category_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_coverage_category(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedCoverageCategory, AppError> {
    let id = validate_category_id(id)?;
    state.coverages.soft_delete_category(&id)
}

#[tauri::command]
pub(crate) fn list_coverages(
    customer_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Coverage>, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    state.coverages.list(&customer_id)
}

#[tauri::command]
pub(crate) fn create_coverage(
    customer_id: String,
    policy_id: String,
    input: CreateCoverageInput,
    state: State<'_, AppState>,
) -> Result<Coverage, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    let policy_id = validate_policy_id(policy_id)?;
    state
        .coverages
        .create(&customer_id, &policy_id, validate_create(input)?)
}

#[tauri::command]
pub(crate) fn update_coverage(
    customer_id: String,
    id: String,
    input: UpdateCoverageInput,
    state: State<'_, AppState>,
) -> Result<Coverage, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    let id = validate_coverage_id(id)?;
    state
        .coverages
        .update(&customer_id, &id, validate_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_coverage(
    customer_id: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedCoverage, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    let id = validate_coverage_id(id)?;
    state.coverages.soft_delete(&customer_id, &id)
}
