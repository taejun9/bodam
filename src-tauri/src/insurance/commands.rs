use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{
    CreateInsurancePolicyInput, DeletedInsurancePolicy, InsurancePolicy, UpdateInsurancePolicyInput,
};
use super::validation::{
    validate_create, validate_customer_id, validate_policy_id, validate_update,
};

#[tauri::command]
pub(crate) fn list_insurance_policies(
    customer_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<InsurancePolicy>, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    state.insurance_policies.list(&customer_id)
}

#[tauri::command]
pub(crate) fn create_insurance_policy(
    customer_id: String,
    input: CreateInsurancePolicyInput,
    state: State<'_, AppState>,
) -> Result<InsurancePolicy, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    state
        .insurance_policies
        .create(&customer_id, validate_create(input)?)
}

#[tauri::command]
pub(crate) fn update_insurance_policy(
    id: String,
    input: UpdateInsurancePolicyInput,
    state: State<'_, AppState>,
) -> Result<InsurancePolicy, AppError> {
    let id = validate_policy_id(id)?;
    state
        .insurance_policies
        .update(&id, validate_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_insurance_policy(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedInsurancePolicy, AppError> {
    let id = validate_policy_id(id)?;
    state.insurance_policies.soft_delete(&id)
}
