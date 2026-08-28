use std::fs;

use uuid::Uuid;

use super::model::{AppSettingsWrite, BackupDirectoryKind};
use super::SettingsRepository;

fn write(theme: &str, recent: i64, unconsulted: i64, limit: i64) -> AppSettingsWrite {
    AppSettingsWrite {
        theme: theme.to_owned(),
        recent_consultation_days: recent,
        unconsulted_days: unconsulted,
        dashboard_item_limit: limit,
    }
}

#[test]
fn loads_defaults_and_updates_preferences_without_changing_path() {
    let repository = SettingsRepository::new_in_memory().expect("settings repository");
    let defaults = repository.load().expect("default settings");
    assert_eq!(defaults.theme, "light");
    assert_eq!(defaults.recent_consultation_days, 30);
    assert_eq!(defaults.unconsulted_days, 90);
    assert_eq!(defaults.dashboard_item_limit, 10);
    assert_eq!(defaults.custom_backup_directory, None);

    let custom = std::env::temp_dir().join("bodam-synthetic-custom-backups");
    repository
        .set_custom_backup_directory(&custom)
        .expect("set custom directory");
    let updated = repository
        .update(write("system", 45, 120, 7))
        .expect("update settings");
    assert_eq!(updated.theme, "system");
    assert_eq!(
        updated.custom_backup_directory.as_deref(),
        Some(custom.as_path())
    );
}

#[test]
fn directory_updates_return_only_kind_and_basename() {
    let repository = SettingsRepository::new_in_memory().expect("settings repository");
    let custom = std::env::temp_dir().join("bodam-safe-directory-label");
    let selected = repository
        .set_custom_backup_directory(&custom)
        .expect("set custom directory");
    assert_eq!(selected.backup_directory.kind, BackupDirectoryKind::Custom);
    assert_eq!(
        selected.backup_directory.basename.as_deref(),
        Some("bodam-safe-directory-label")
    );
    let encoded = serde_json::to_string(&selected).expect("serialize settings view");
    assert!(!encoded.contains(&custom.to_string_lossy().to_string()));
    assert!(!encoded.contains("customBackupDirectory"));
    assert_eq!(
        repository.custom_backup_directory().expect("load path"),
        Some(custom)
    );

    let cleared = repository
        .clear_custom_backup_directory()
        .expect("clear custom directory");
    assert_eq!(cleared.backup_directory.kind, BackupDirectoryKind::Default);
    assert_eq!(cleared.backup_directory.basename, None);
}

#[test]
fn rejects_relative_root_and_unsafe_basename_without_mutation() {
    let repository = SettingsRepository::new_in_memory().expect("settings repository");
    let root = std::path::Path::new(std::path::MAIN_SEPARATOR_STR);
    let unsafe_name = std::env::temp_dir().join("unsafe\nbackups");
    for rejected in [std::path::Path::new("relative/backups"), root, &unsafe_name] {
        assert!(repository.set_custom_backup_directory(rejected).is_err());
    }
    assert_eq!(
        repository
            .custom_backup_directory()
            .expect("unchanged path"),
        None
    );
}

#[test]
fn rejects_invalid_stored_custom_path_without_exposing_it() {
    let path = std::env::temp_dir().join(format!(
        "bodam-settings-invalid-path-{}.sqlite3",
        Uuid::new_v4()
    ));
    {
        let connection = crate::database::open(&path).expect("settings database");
        let private_marker = std::env::temp_dir().join("synthetic-private\nbackups");
        connection
            .execute(
                "UPDATE app_settings SET custom_backup_directory = ?1 WHERE id = 1",
                [private_marker.to_string_lossy().as_ref()],
            )
            .expect("seed invalid custom path");
    }
    let repository = SettingsRepository::open(&path).expect("settings repository");
    let error = repository.load().expect_err("reject invalid stored path");
    let encoded = serde_json::to_string(&error).expect("serialize safe error");
    assert!(!encoded.contains("synthetic-private"));
    drop(repository);
    cleanup(&path);
}

#[test]
fn persists_settings_across_repository_reopen() {
    let path = std::env::temp_dir().join(format!(
        "bodam-settings-repository-{}.sqlite3",
        Uuid::new_v4()
    ));
    let custom = std::env::temp_dir().join("bodam-persisted-backups");
    {
        let repository = SettingsRepository::open(&path).expect("open settings repository");
        repository
            .set_custom_backup_directory(&custom)
            .expect("set directory");
        repository
            .update(write("system", 60, 180, 5))
            .expect("update settings");
    }
    let reopened = SettingsRepository::open(&path).expect("reopen settings repository");
    let settings = reopened.load().expect("persisted settings");
    assert_eq!(
        settings,
        super::model::StoredAppSettings {
            theme: "system".to_owned(),
            recent_consultation_days: 60,
            unconsulted_days: 180,
            dashboard_item_limit: 5,
            custom_backup_directory: Some(custom),
        }
    );
    drop(reopened);
    cleanup(&path);
}

fn cleanup(path: &std::path::Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database") {
            fs::remove_file(candidate).expect("remove temporary database");
        }
    }
}
