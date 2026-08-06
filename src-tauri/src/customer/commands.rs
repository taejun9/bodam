use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{CreateCustomerInput, Customer, DeletedCustomer, UpdateCustomerInput};
use super::validation::{validate_create, validate_customer_id, validate_search, validate_update};

#[tauri::command]
pub(crate) fn list_customers(
    search: Option<String>,
    state: State<'_, AppState>,
) -> Result<Vec<Customer>, AppError> {
    state.customers.list(validate_search(search)?)
}

#[tauri::command]
pub(crate) fn create_customer(
    input: CreateCustomerInput,
    state: State<'_, AppState>,
) -> Result<Customer, AppError> {
    state.customers.create(validate_create(input)?)
}

#[tauri::command]
pub(crate) fn update_customer(
    id: String,
    input: UpdateCustomerInput,
    state: State<'_, AppState>,
) -> Result<Customer, AppError> {
    let id = validate_customer_id(id)?;
    state.customers.update(&id, validate_update(input)?)
}

#[tauri::command]
pub(crate) fn delete_customer(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedCustomer, AppError> {
    let id = validate_customer_id(id)?;
    state.customers.soft_delete(&id)
}
