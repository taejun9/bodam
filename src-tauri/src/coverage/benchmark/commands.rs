use tauri::State;

use crate::coverage::CoverageRepository;
use crate::error::AppError;
use crate::AppState;

use super::model::{
    CoverageBenchmark, CreateCoverageBenchmarkInput, DeletedCoverageBenchmark,
    UpdateCoverageBenchmarkInput,
};
use super::validation::{validate_benchmark_id, validate_create, validate_update};

#[tauri::command]
pub(crate) fn list_coverage_benchmarks(
    state: State<'_, AppState>,
) -> Result<Vec<CoverageBenchmark>, AppError> {
    list_with_repository(&state.coverages)
}

#[tauri::command]
pub(crate) fn create_coverage_benchmark(
    input: CreateCoverageBenchmarkInput,
    state: State<'_, AppState>,
) -> Result<CoverageBenchmark, AppError> {
    create_with_repository(&state.coverages, input)
}

#[tauri::command]
pub(crate) fn update_coverage_benchmark(
    id: String,
    input: UpdateCoverageBenchmarkInput,
    state: State<'_, AppState>,
) -> Result<CoverageBenchmark, AppError> {
    update_with_repository(&state.coverages, id, input)
}

#[tauri::command]
pub(crate) fn delete_coverage_benchmark(
    id: String,
    state: State<'_, AppState>,
) -> Result<DeletedCoverageBenchmark, AppError> {
    delete_with_repository(&state.coverages, id)
}

pub(super) fn list_with_repository(
    repository: &CoverageRepository,
) -> Result<Vec<CoverageBenchmark>, AppError> {
    repository.list_benchmarks()
}

pub(super) fn create_with_repository(
    repository: &CoverageRepository,
    input: CreateCoverageBenchmarkInput,
) -> Result<CoverageBenchmark, AppError> {
    repository.create_benchmark(validate_create(input)?)
}

pub(super) fn update_with_repository(
    repository: &CoverageRepository,
    id: String,
    input: UpdateCoverageBenchmarkInput,
) -> Result<CoverageBenchmark, AppError> {
    let id = validate_benchmark_id(id)?;
    repository.update_benchmark(&id, validate_update(input)?)
}

pub(super) fn delete_with_repository(
    repository: &CoverageRepository,
    id: String,
) -> Result<DeletedCoverageBenchmark, AppError> {
    let id = validate_benchmark_id(id)?;
    repository.soft_delete_benchmark(&id)
}
