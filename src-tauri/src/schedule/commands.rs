use tauri::State;

use crate::error::AppError;
use crate::AppState;

use super::model::{CreateScheduleInput, DeletedSchedule, Schedule, UpdateScheduleInput};
use super::validation::{validate_create, validate_range, validate_schedule_id, validate_update};
use super::ScheduleRepository;

#[tauri::command]
pub(crate) fn list_schedules(
    start_on: String,
    end_before: String,
    state: State<'_, AppState>,
) -> Result<Vec<Schedule>, AppError> {
    list_with_repository(&state.schedules, start_on, end_before)
}

#[tauri::command]
pub(crate) fn create_schedule(
    input: CreateScheduleInput,
    state: State<'_, AppState>,
) -> Result<Schedule, AppError> {
    create_with_repository(&state.schedules, input)
}

#[tauri::command]
pub(crate) fn update_schedule(
    id: String,
    input: UpdateScheduleInput,
    state: State<'_, AppState>,
) -> Result<Schedule, AppError> {
    update_with_repository(&state.schedules, id, input)
}

#[tauri::command]
pub(crate) fn set_schedule_completed(
    id: String,
    is_completed: bool,
    state: State<'_, AppState>,
) -> Result<Schedule, AppError> {
    set_completed_with_repository(&state.schedules, id, is_completed)
}

#[tauri::command]
pub(crate) fn delete_schedule(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedSchedule, AppError> {
    delete_with_repository(&state.schedules, id)
}

pub(super) fn list_with_repository(
    repository: &ScheduleRepository,
    start_on: String,
    end_before: String,
) -> Result<Vec<Schedule>, AppError> {
    repository.list(&validate_range(start_on, end_before)?)
}

pub(super) fn create_with_repository(
    repository: &ScheduleRepository,
    input: CreateScheduleInput,
) -> Result<Schedule, AppError> {
    repository.create(validate_create(input)?)
}

pub(super) fn update_with_repository(
    repository: &ScheduleRepository,
    id: String,
    input: UpdateScheduleInput,
) -> Result<Schedule, AppError> {
    repository.update(&validate_schedule_id(id)?, validate_update(input)?)
}

pub(super) fn set_completed_with_repository(
    repository: &ScheduleRepository,
    id: String,
    is_completed: bool,
) -> Result<Schedule, AppError> {
    repository.set_completed(&validate_schedule_id(id)?, is_completed)
}

pub(super) fn delete_with_repository(
    repository: &ScheduleRepository,
    id: String,
) -> Result<DeletedSchedule, AppError> {
    repository.soft_delete(&validate_schedule_id(id)?)
}
