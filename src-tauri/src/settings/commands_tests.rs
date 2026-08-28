use crate::error::AppError;

use super::commands::{load_with_repository, update_with_repository};
use super::model::{BackupDirectoryKind, UpdateAppSettingsInput};
use super::SettingsRepository;

#[test]
fn command_boundary_loads_and_updates_safe_settings_contract() {
    let repository = SettingsRepository::new_in_memory().expect("settings repository");
    let defaults = load_with_repository(&repository).expect("load defaults");
    assert_eq!(defaults.theme, "light");
    assert_eq!(defaults.backup_directory.kind, BackupDirectoryKind::Default);

    let updated = update_with_repository(
        &repository,
        UpdateAppSettingsInput {
            theme: "system".to_owned(),
            recent_consultation_days: 45,
            unconsulted_days: 120,
            dashboard_item_limit: 6,
        },
    )
    .expect("update settings");
    assert_eq!(updated.theme, "system");
    assert_eq!(updated.recent_consultation_days, 45);
    assert_eq!(updated.unconsulted_days, 120);
    assert_eq!(updated.dashboard_item_limit, 6);
}

#[test]
fn command_boundary_redacts_rejected_values_and_preserves_existing_settings() {
    let repository = SettingsRepository::new_in_memory().expect("settings repository");
    let rejected = "synthetic-rejected-theme-marker";
    let error = update_with_repository(
        &repository,
        UpdateAppSettingsInput {
            theme: rejected.to_owned(),
            recent_consultation_days: 30,
            unconsulted_days: 90,
            dashboard_item_limit: 10,
        },
    )
    .expect_err("reject invalid settings");
    assert!(matches!(error, AppError::Validation(_)));
    assert!(!serde_json::to_string(&error)
        .expect("serialize error")
        .contains(rejected));
    assert_eq!(
        load_with_repository(&repository)
            .expect("unchanged settings")
            .theme,
        "light"
    );
}
