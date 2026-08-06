use serde_json::json;

use super::{
    effective_status_failure, validate_timestamp, validate_token, BackupLocationKind,
    BackupResultView, BackupStatusView, RestorePreviewView, RETENTION_WARNING,
};
use crate::backup::model::{
    BackupManifest, BackupReason, BackupResult, BackupStatus, RestorePreview, BACKUP_FORMAT_VERSION,
};

#[test]
fn status_preserves_31_of_30_and_infers_retention_warning_after_restart() {
    let core = BackupStatus {
        directory_available: true,
        automatic_count: 31,
        last_success_at_utc: Some("2026-08-07T01:02:03.004Z".into()),
    };
    let failure = effective_status_failure(&core, None);
    let view =
        BackupStatusView::from_core(core, BackupLocationKind::Default, None, failure, None, true)
            .unwrap();

    assert_eq!(
        serde_json::to_value(view).unwrap(),
        json!({
            "available": true,
            "location": { "kind": "default", "basename": null, "available": true },
            "lastSuccessfulAt": "2026-08-07T01:02:03.004Z",
            "automaticCount": 31,
            "maxAutomaticCount": 30,
            "lastFailure": RETENTION_WARNING,
            "restoreStartup": null,
            "exitFailurePending": true,
        })
    );
}

#[test]
fn unavailable_directory_gets_a_static_pathless_failure() {
    let core = BackupStatus {
        directory_available: false,
        automatic_count: 0,
        last_success_at_utc: None,
    };
    let failure = effective_status_failure(&core, None).unwrap();
    assert_eq!(
        failure,
        crate::backup::BackupError::path_unavailable().message
    );
    assert!(!failure.contains('/'));
    assert!(!failure.contains('\\'));
    let view = BackupStatusView::from_core(
        core,
        BackupLocationKind::Custom,
        Some("synthetic-offline-backups".into()),
        Some(failure),
        None,
        false,
    )
    .unwrap();
    let encoded = serde_json::to_value(view).unwrap();
    assert_eq!(encoded["available"], true);
    assert_eq!(encoded["location"]["available"], false);
}

#[test]
fn manual_result_maps_only_strict_pathless_metadata() {
    let mapped = BackupResultView::try_from(BackupResult {
        created: true,
        basename: Some("BODAM-manual-safe.bodam-backup".into()),
        manifest: Some(manifest()),
        retention_warning_count: 1,
    })
    .unwrap();
    let encoded = serde_json::to_value(mapped).unwrap();
    assert_eq!(encoded["reason"], "manual");
    assert_eq!(encoded["retentionWarning"], true);
    assert!(encoded.get("path").is_none());

    let invalid = BackupResult {
        created: true,
        basename: Some("unsafe\u{7f}.bodam-backup".into()),
        manifest: Some(manifest()),
        retention_warning_count: 0,
    };
    assert_eq!(
        BackupResultView::try_from(invalid).unwrap_err().code,
        "BACKUP_ARCHIVE_INVALID"
    );
}

#[test]
fn restore_preview_rejects_noncanonical_non_v4_and_unsafe_values() {
    let invalid_tokens = [
        "too-long-or-short".to_owned(),
        "12000000-0000-1000-8000-000000000001".to_owned(),
        "12abcdef-0000-4000-8000-000000000001".to_uppercase(),
    ];
    for token in &invalid_tokens {
        assert_eq!(
            validate_token(token).unwrap_err().code,
            "RESTORE_PREVIEW_UNAVAILABLE"
        );
    }

    let invalid = RestorePreview {
        token: "12000000-0000-4000-8000-000000000001".into(),
        basename: "unsafe/path.bodam-backup".into(),
        created_at_utc: "2026-08-07T01:02:03.004Z".into(),
        reason: BackupReason::Manual,
        app_version: "0.1.0".into(),
        schema_migration_count: 9,
        schema_last_migration: "20260806080000_add_app_settings".into(),
    };
    assert_eq!(
        RestorePreviewView::try_from(invalid).unwrap_err().code,
        "BACKUP_ARCHIVE_INVALID"
    );
}

#[test]
fn ipc_views_reject_noncanonical_utc_timestamps() {
    assert!(validate_timestamp("2026-08-07T01:02:03.004Z").is_ok());
    for timestamp in [
        "2026-08-07T01:02:03.004+00:00",
        "2026-08-07T01:02:03Z",
        "2026-08-07T01:02:03.04Z",
        "2026-08-07T01:02:03.0040Z",
    ] {
        assert_eq!(
            validate_timestamp(timestamp).unwrap_err().code,
            "BACKUP_ARCHIVE_INVALID",
            "accepted noncanonical timestamp {timestamp}"
        );
    }
}

fn manifest() -> BackupManifest {
    BackupManifest {
        format_version: BACKUP_FORMAT_VERSION,
        created_at_utc: "2026-08-07T01:02:03.004Z".into(),
        local_date: "2026-08-07".into(),
        reason: BackupReason::Manual,
        app_version: "0.1.0".into(),
        schema_migration_count: 9,
        schema_last_migration: "20260806080000_add_app_settings".into(),
        database_size_bytes: 4096,
        database_sha256: "a".repeat(64),
    }
}
