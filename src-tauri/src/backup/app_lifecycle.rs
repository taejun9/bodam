use tauri::{AppHandle, Emitter, Manager, RunEvent, WindowEvent, RESTART_EXIT_CODE};

use super::BackupRuntime;

const EXIT_BACKUP_FAILED_EVENT: &str = "bodam://exit-backup-failed";

pub(crate) fn handle_run_event(app: &AppHandle, event: RunEvent) {
    match event {
        RunEvent::WindowEvent {
            event: WindowEvent::CloseRequested { api, .. },
            ..
        } => {
            if let Some(runtime) = runtime_to_intercept(app) {
                api.prevent_close();
                start_exit_backup(app.clone(), runtime);
            }
        }
        RunEvent::ExitRequested { code, api, .. } if code != Some(RESTART_EXIT_CODE) => {
            if let Some(runtime) = runtime_to_intercept(app) {
                api.prevent_exit();
                start_exit_backup(app.clone(), runtime);
            }
        }
        _ => {}
    }
}

fn runtime_to_intercept(app: &AppHandle) -> Option<BackupRuntime> {
    let runtime = app.try_state::<BackupRuntime>()?.inner().clone();
    (!runtime.take_exit_bypass()).then_some(runtime)
}

fn start_exit_backup(app: AppHandle, runtime: BackupRuntime) {
    match runtime.begin_exit_backup() {
        Ok(true) => {
            let _worker = tauri::async_runtime::spawn_blocking(move || {
                if runtime.complete_exit_backup().is_ok() {
                    app.exit(0);
                } else {
                    emit_failure(&app);
                }
            });
        }
        Ok(false) => {
            if runtime.exit_failure_pending() {
                emit_failure(&app);
            }
        }
        Err(_) => emit_failure(&app),
    }
}

fn emit_failure(app: &AppHandle) {
    let _ = app.emit(EXIT_BACKUP_FAILED_EVENT, ());
}
