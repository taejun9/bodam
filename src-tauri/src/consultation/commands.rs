use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{
    Consultation, CreateConsultationInput, DeletedConsultation, UpdateConsultationInput,
};
use super::validation::{
    validate_consultation_id, validate_create, validate_customer_id, validate_update,
};
use super::ConsultationRepository;

#[tauri::command]
pub(crate) fn list_consultations(
    customer_id: String,
    state: State<'_, AppState>,
) -> Result<Vec<Consultation>, AppError> {
    list_with_repository(&state.consultations, customer_id)
}

#[tauri::command]
pub(crate) fn create_consultation(
    customer_id: String,
    input: CreateConsultationInput,
    state: State<'_, AppState>,
) -> Result<Consultation, AppError> {
    create_with_repository(&state.consultations, customer_id, input)
}

#[tauri::command]
pub(crate) fn update_consultation(
    id: String,
    input: UpdateConsultationInput,
    state: State<'_, AppState>,
) -> Result<Consultation, AppError> {
    update_with_repository(&state.consultations, id, input)
}

#[tauri::command]
pub(crate) fn delete_consultation(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedConsultation, AppError> {
    delete_with_repository(&state.consultations, id)
}

pub(super) fn list_with_repository(
    repository: &ConsultationRepository,
    customer_id: String,
) -> Result<Vec<Consultation>, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    repository.list(&customer_id)
}

pub(super) fn create_with_repository(
    repository: &ConsultationRepository,
    customer_id: String,
    input: CreateConsultationInput,
) -> Result<Consultation, AppError> {
    let customer_id = validate_customer_id(customer_id)?;
    repository.create(&customer_id, validate_create(input)?)
}

pub(super) fn update_with_repository(
    repository: &ConsultationRepository,
    id: String,
    input: UpdateConsultationInput,
) -> Result<Consultation, AppError> {
    let id = validate_consultation_id(id)?;
    repository.update(&id, validate_update(input)?)
}

pub(super) fn delete_with_repository(
    repository: &ConsultationRepository,
    id: String,
) -> Result<DeletedConsultation, AppError> {
    let id = validate_consultation_id(id)?;
    repository.soft_delete(&id)
}
