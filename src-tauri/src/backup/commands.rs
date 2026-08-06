use std::path::PathBuf;

use serde::de::{Deserialize, Deserializer, Error as _};
use tauri::{AppHandle, State};
#[cfg(not(feature = "e2e"))]
use tauri_plugin_dialog::DialogExt;
use uuid::Uuid;

use super::runtime::{
    BackupResultView, BackupRuntime, BackupStatusView, RestorePreparedView, RestorePreviewView,
};
use super::BackupError;

#[derive(Debug)]
pub(crate) struct RestoreToken(String);

impl<'de> Deserialize<'de> for RestoreToken {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = String::deserialize(deserializer)?;
        if !valid_restore_token(&value) {
            return Err(D::Error::custom("invalid restore token"));
        }
        Ok(Self(value))
    }
}

#[tauri::command]
pub(crate) async fn load_backup_status(
    state: State<'_, BackupRuntime>,
) -> Result<BackupStatusView, BackupError> {
    run_blocking(state.inner().clone(), |runtime| runtime.load_status()).await
}

#[tauri::command]
pub(crate) async fn acknowledge_restore_startup(
    state: State<'_, BackupRuntime>,
) -> Result<(), BackupError> {
    run_blocking(state.inner().clone(), acknowledge_restore_startup_operation).await
}

fn acknowledge_restore_startup_operation(runtime: BackupRuntime) -> Result<(), BackupError> {
    runtime.acknowledge_restore_startup()
}

#[tauri::command]
pub(crate) async fn choose_backup_directory(
    app: AppHandle,
    state: State<'_, BackupRuntime>,
) -> Result<Option<BackupStatusView>, BackupError> {
    run_blocking(state.inner().clone(), move |runtime| {
        let Some(directory) = choose_directory_path(app)? else {
            return Ok(None);
        };
        runtime.select_directory(directory).map(Some)
    })
    .await
}

#[tauri::command]
pub(crate) async fn use_default_backup_directory(
    state: State<'_, BackupRuntime>,
) -> Result<BackupStatusView, BackupError> {
    run_blocking(state.inner().clone(), |runtime| {
        runtime.use_default_directory()
    })
    .await
}

#[tauri::command]
pub(crate) async fn create_manual_backup(
    state: State<'_, BackupRuntime>,
) -> Result<BackupResultView, BackupError> {
    run_blocking(state.inner().clone(), |runtime| {
        runtime.create_manual_backup()
    })
    .await
}

#[tauri::command]
pub(crate) async fn choose_restore_backup(
    app: AppHandle,
    state: State<'_, BackupRuntime>,
) -> Result<Option<RestorePreviewView>, BackupError> {
    run_blocking(state.inner().clone(), move |runtime| {
        let Some(source) = choose_restore_path(app)? else {
            return Ok(None);
        };
        runtime.preview_restore(&source).map(Some)
    })
    .await
}

#[tauri::command]
pub(crate) async fn discard_restore_preview(
    token: RestoreToken,
    state: State<'_, BackupRuntime>,
) -> Result<(), BackupError> {
    run_blocking(state.inner().clone(), move |runtime| {
        runtime.discard_restore_preview(&token.0)
    })
    .await
}

#[tauri::command]
pub(crate) async fn prepare_backup_restore(
    token: RestoreToken,
    state: State<'_, BackupRuntime>,
) -> Result<RestorePreparedView, BackupError> {
    run_blocking(state.inner().clone(), move |runtime| {
        runtime.prepare_restore(&token.0)
    })
    .await
}

#[tauri::command]
pub(crate) fn restart_for_backup_restore(
    app: AppHandle,
    state: State<'_, BackupRuntime>,
) -> Result<(), BackupError> {
    let phased = phased_e2e_restart()?;
    state.authorize_restore_restart()?;
    if phased {
        app.exit(0);
    } else {
        app.request_restart();
    }
    Ok(())
}

#[tauri::command]
pub(crate) async fn check_daily_backup(
    state: State<'_, BackupRuntime>,
) -> Result<BackupStatusView, BackupError> {
    run_blocking(state.inner().clone(), |runtime| {
        runtime.check_daily_backup()
    })
    .await
}

#[tauri::command]
pub(crate) async fn retry_exit_backup(
    app: AppHandle,
    state: State<'_, BackupRuntime>,
) -> Result<(), BackupError> {
    run_blocking(state.inner().clone(), |runtime| runtime.retry_exit_backup()).await?;
    app.exit(0);
    Ok(())
}

#[tauri::command]
pub(crate) fn exit_without_backup(
    app: AppHandle,
    state: State<'_, BackupRuntime>,
) -> Result<(), BackupError> {
    state.allow_exit_without_backup()?;
    app.exit(0);
    Ok(())
}

async fn run_blocking<T>(
    runtime: BackupRuntime,
    operation: impl FnOnce(BackupRuntime) -> Result<T, BackupError> + Send + 'static,
) -> Result<T, BackupError>
where
    T: Send + 'static,
{
    tauri::async_runtime::spawn_blocking(move || operation(runtime))
        .await
        .map_err(|_| worker_unavailable())?
}

#[cfg(not(feature = "e2e"))]
fn choose_directory_path(app: AppHandle) -> Result<Option<PathBuf>, BackupError> {
    let selected = app
        .dialog()
        .file()
        .set_title("백업 폴더 선택")
        .blocking_pick_folder();
    selected
        .map(|value| {
            value
                .into_path()
                .map_err(|_| BackupError::path_unavailable())
        })
        .transpose()
}

#[cfg(feature = "e2e")]
fn choose_directory_path(_app: AppHandle) -> Result<Option<PathBuf>, BackupError> {
    crate::e2e_backup_paths::validate_backup_directory(
        std::env::var_os("BODAM_E2E_BACKUP_DIRECTORY"),
        std::env::var_os("BODAM_E2E_DB_PATH"),
    )
    .map_err(|_| e2e_path_invalid())
}

#[cfg(not(feature = "e2e"))]
fn choose_restore_path(app: AppHandle) -> Result<Option<PathBuf>, BackupError> {
    let selected = app
        .dialog()
        .file()
        .set_title("BODAM 백업에서 복원")
        .add_filter("BODAM 백업", &["bodam-backup"])
        .blocking_pick_file();
    selected
        .map(|value| {
            value
                .into_path()
                .map_err(|_| BackupError::path_unavailable())
        })
        .transpose()
}

#[cfg(feature = "e2e")]
fn choose_restore_path(_app: AppHandle) -> Result<Option<PathBuf>, BackupError> {
    crate::e2e_backup_paths::validate_restore_file(
        std::env::var_os("BODAM_E2E_RESTORE_FILE"),
        std::env::var_os("BODAM_E2E_BACKUP_DIRECTORY"),
        std::env::var_os("BODAM_E2E_DB_PATH"),
    )
    .map_err(|_| e2e_path_invalid())
}

#[cfg(feature = "e2e")]
fn phased_e2e_restart() -> Result<bool, BackupError> {
    if std::env::var_os("BODAM_E2E_PHASED_RESTART").as_deref() != Some(std::ffi::OsStr::new("1")) {
        return Ok(false);
    }
    crate::e2e_backup_paths::validate_app_data_directory(std::env::var_os("BODAM_E2E_DB_PATH"))
        .map_err(|_| e2e_path_invalid())?;
    Ok(true)
}

#[cfg(not(feature = "e2e"))]
fn phased_e2e_restart() -> Result<bool, BackupError> {
    Ok(false)
}

fn valid_restore_token(value: &str) -> bool {
    value.len() == 36
        && Uuid::parse_str(value).is_ok_and(|parsed| {
            parsed.get_version_num() == 4 && parsed.hyphenated().to_string() == value
        })
}

fn worker_unavailable() -> BackupError {
    BackupError::new(
        "BACKUP_WORKER_UNAVAILABLE",
        "백업 작업을 완료할 수 없습니다.",
    )
}

#[cfg(feature = "e2e")]
fn e2e_path_invalid() -> BackupError {
    BackupError::new(
        "E2E_BACKUP_PATH_INVALID",
        "E2E 백업 경로 구성을 확인할 수 없습니다.",
    )
}

#[cfg(test)]
#[path = "commands_tests.rs"]
mod tests;
