use super::super::BackupError;

#[derive(Debug, Default)]
pub(super) struct LifecycleState {
    exit: ExitGate,
    restore: RestoreGate,
}

#[derive(Debug, Default, Eq, PartialEq)]
enum ExitGate {
    #[default]
    Idle,
    Running,
    Failed,
    BypassOnce,
}

#[derive(Debug, Default, Eq, PartialEq)]
enum RestoreGate {
    #[default]
    Idle,
    Preview(String),
    PendingRestart,
    RestartRequested,
}

impl LifecycleState {
    pub(super) fn begin_initial_exit_backup(&mut self) -> bool {
        if self.exit != ExitGate::Idle {
            return false;
        }
        self.exit = ExitGate::Running;
        true
    }

    pub(super) fn exit_failure_pending(&self) -> bool {
        self.exit == ExitGate::Failed
    }

    pub(super) fn mark_exit_failure(&mut self) {
        self.exit = ExitGate::Failed;
    }

    pub(super) fn begin_exit_retry(&mut self) -> Result<(), BackupError> {
        if self.exit != ExitGate::Failed {
            return Err(exit_action_unavailable());
        }
        self.exit = ExitGate::Running;
        Ok(())
    }

    pub(super) fn allow_failed_exit_once(&mut self) -> Result<(), BackupError> {
        if self.exit != ExitGate::Failed {
            return Err(exit_action_unavailable());
        }
        self.exit = ExitGate::BypassOnce;
        Ok(())
    }

    pub(super) fn finish_exit_success(&mut self) {
        self.exit = ExitGate::BypassOnce;
    }

    pub(super) fn take_exit_bypass(&mut self) -> bool {
        if self.exit != ExitGate::BypassOnce {
            return false;
        }
        self.exit = ExitGate::Idle;
        true
    }

    pub(super) fn allow_preview_change(&self) -> Result<(), BackupError> {
        match self.restore {
            RestoreGate::Idle | RestoreGate::Preview(_) => Ok(()),
            RestoreGate::PendingRestart | RestoreGate::RestartRequested => {
                Err(BackupError::preview_unavailable())
            }
        }
    }

    pub(super) fn remember_preview(&mut self, token: String) {
        self.restore = RestoreGate::Preview(token);
    }

    pub(super) fn require_preview(&self, token: &str) -> Result<(), BackupError> {
        match &self.restore {
            RestoreGate::Preview(current) if current == token => Ok(()),
            _ => Err(BackupError::preview_unavailable()),
        }
    }

    pub(super) fn discard_preview(&mut self) {
        self.restore = RestoreGate::Idle;
    }

    pub(super) fn mark_restore_pending(&mut self) {
        self.restore = RestoreGate::PendingRestart;
    }

    pub(super) fn authorize_restore_restart(&mut self) -> Result<(), BackupError> {
        if self.restore != RestoreGate::PendingRestart {
            return Err(restore_restart_unavailable());
        }
        self.restore = RestoreGate::RestartRequested;
        self.exit = ExitGate::BypassOnce;
        Ok(())
    }
}

fn exit_action_unavailable() -> BackupError {
    BackupError::new(
        "EXIT_BACKUP_ACTION_UNAVAILABLE",
        "종료 백업 실패 상태가 더 이상 유효하지 않습니다.",
    )
}

fn restore_restart_unavailable() -> BackupError {
    BackupError::new(
        "RESTORE_RESTART_UNAVAILABLE",
        "재시작할 복원 요청이 준비되지 않았습니다.",
    )
}

#[cfg(test)]
#[path = "runtime_lifecycle_tests.rs"]
mod tests;
