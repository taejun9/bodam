use super::LifecycleState;

#[test]
fn exit_override_is_available_only_after_a_real_failure_and_only_once() {
    let mut state = LifecycleState::default();
    assert_eq!(
        state.allow_failed_exit_once().unwrap_err().code,
        "EXIT_BACKUP_ACTION_UNAVAILABLE"
    );
    assert!(!state.take_exit_bypass());

    assert!(state.begin_initial_exit_backup());
    state.mark_exit_failure();
    assert!(state.exit_failure_pending());
    assert!(!state.begin_initial_exit_backup());
    assert!(state.exit_failure_pending());
    state.allow_failed_exit_once().unwrap();
    assert!(!state.exit_failure_pending());
    assert!(state.take_exit_bypass());
    assert!(!state.take_exit_bypass());
}

#[test]
fn retry_success_can_authorize_exit_but_a_failure_stays_retryable() {
    let mut state = LifecycleState::default();
    assert!(state.begin_initial_exit_backup());
    state.mark_exit_failure();
    assert!(state.exit_failure_pending());
    state.begin_exit_retry().unwrap();
    assert!(!state.exit_failure_pending());
    state.mark_exit_failure();
    state.begin_exit_retry().unwrap();
    state.finish_exit_success();
    assert!(state.take_exit_bypass());
}

#[test]
fn repeated_close_while_running_never_starts_a_second_worker() {
    let mut state = LifecycleState::default();
    assert!(state.begin_initial_exit_backup());
    assert!(!state.begin_initial_exit_backup());
    state.finish_exit_success();
    assert!(!state.begin_initial_exit_backup());
    assert!(state.take_exit_bypass());
}

#[test]
fn restore_restart_requires_this_process_to_prepare_a_matching_preview() {
    let token = "12000000-0000-4000-8000-000000000001";
    let mut state = LifecycleState::default();
    assert_eq!(
        state.authorize_restore_restart().unwrap_err().code,
        "RESTORE_RESTART_UNAVAILABLE"
    );

    state.allow_preview_change().unwrap();
    state.remember_preview(token.to_owned());
    assert!(state
        .require_preview("22000000-0000-4000-8000-000000000002")
        .is_err());
    state.require_preview(token).unwrap();
    state.mark_restore_pending();
    assert!(state.allow_preview_change().is_err());
    state.authorize_restore_restart().unwrap();
    assert!(state.authorize_restore_restart().is_err());
    assert!(state.take_exit_bypass());
}

#[test]
fn discard_requires_the_current_token_and_revokes_the_preview() {
    let token = "12000000-0000-4000-8000-000000000001";
    let mut state = LifecycleState::default();
    state.remember_preview(token.to_owned());
    assert!(state.require_preview("different").is_err());
    state.require_preview(token).unwrap();
    state.discard_preview();
    assert!(state.require_preview(token).is_err());
}
