use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{
    AddFamilyMembershipInput, CreateFamilyInput, DeletedFamily, DeletedFamilyMembership, Family,
    FamilyMembership, UpdateFamilyInput, UpdateFamilyMembershipInput,
};
use super::validation::{
    validate_add, validate_create, validate_family_id, validate_membership_id,
    validate_membership_update, validate_parent_family_id, validate_search, validate_update,
};

#[tauri::command]
pub(crate) fn list_families(
    search: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Family>, AppError> {
    state.families.list(validate_search(search)?)
}

#[tauri::command]
pub(crate) fn create_family(
    input: CreateFamilyInput,
    state: State<'_, AppState>,
) -> Result<Family, AppError> {
    state.families.create(validate_create(input)?)
}

#[tauri::command]
pub(crate) fn update_family(
    id: String,
    input: UpdateFamilyInput,
    state: State<'_, AppState>,
) -> Result<Family, AppError> {
    let id = validate_family_id(id)?;
    state.families.update(&id, validate_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_family(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedFamily, AppError> {
    let id = validate_family_id(id)?;
    state.families.soft_delete(&id)
}

#[tauri::command]
pub(crate) fn list_family_memberships(
    family_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<FamilyMembership>, AppError> {
    let family_id = validate_parent_family_id(family_id)?;
    state.families.list_memberships(&family_id)
}

#[tauri::command]
pub(crate) fn add_family_membership(
    family_id: String,
    input: AddFamilyMembershipInput,
    state: State<'_, AppState>,
) -> Result<FamilyMembership, AppError> {
    let family_id = validate_parent_family_id(family_id)?;
    state
        .families
        .add_membership(&family_id, validate_add(input)?)
}

#[tauri::command]
pub(crate) fn update_family_membership(
    family_id: String,
    id: String,
    input: UpdateFamilyMembershipInput,
    state: State<'_, AppState>,
) -> Result<FamilyMembership, AppError> {
    let family_id = validate_parent_family_id(family_id)?;
    let id = validate_membership_id(id)?;
    state
        .families
        .update_membership(&family_id, &id, validate_membership_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_family_membership(
    family_id: String,
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedFamilyMembership, AppError> {
    let family_id = validate_parent_family_id(family_id)?;
    let id = validate_membership_id(id)?;
    state.families.soft_delete_membership(&family_id, &id)
}
