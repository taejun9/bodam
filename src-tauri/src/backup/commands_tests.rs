use std::fs;
use std::path::PathBuf;

use uuid::Uuid;

use super::{acknowledge_restore_startup_operation, RestoreToken};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::model::{RestoreOutcome, StartupRestoreStatus};
use crate::backup::restore_state::write_status;
use crate::backup::{read_startup_status, BackupRuntime};

#[test]
fn restore_token_accepts_only_canonical_v4_strings() {
    let valid = r#""12000000-0000-4000-8000-000000000001""#;
    assert!(serde_json::from_str::<RestoreToken>(valid).is_ok());

    let invalid_values = [
        r#""12000000-0000-1000-8000-000000000001""#.to_owned(),
        r#""12000000-0000-4000-8000-0000000000010""#.to_owned(),
        r#""12abcdef-0000-4000-8000-000000000001""#.to_uppercase(),
        r#"{"token":"12000000-0000-4000-8000-000000000001","path":"/private"}"#.to_owned(),
    ];
    for invalid in &invalid_values {
        assert!(serde_json::from_str::<RestoreToken>(invalid).is_err());
    }
}

#[test]
fn malformed_token_errors_never_reflect_the_rejected_value() {
    let rejected = format!("{}private-marker", "x".repeat(4096));
    let encoded = serde_json::to_string(&rejected).unwrap();
    let error = serde_json::from_str::<RestoreToken>(&encoded).unwrap_err();
    assert!(!error.to_string().contains("private-marker"));
}

#[test]
fn startup_ack_command_operation_clears_only_after_a_separate_load() {
    let root = TestRoot::new();
    let app_data = root.directory("app-data");
    let database = root.path().join("bodam.sqlite3");
    drop(crate::database::open(&database).unwrap());
    let status = StartupRestoreStatus {
        outcome: RestoreOutcome::Restored,
        backup_basename: "BODAM-manual-command.bodam-backup".into(),
        completed_at_utc: "2026-08-07T01:02:03.004Z".into(),
    };
    write_status(&app_data, &status, &OsAtomicReplacer).unwrap();
    let runtime = BackupRuntime::open(
        database,
        app_data.clone(),
        "0.1.0".into(),
        Some(status.clone()),
    )
    .unwrap();

    runtime.load_status().unwrap();
    assert_eq!(read_startup_status(&app_data).unwrap(), Some(status));
    acknowledge_restore_startup_operation(runtime).unwrap();
    assert_eq!(read_startup_status(&app_data).unwrap(), None);
}

struct TestRoot(PathBuf);

impl TestRoot {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-command-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &std::path::Path {
        &self.0
    }

    fn directory(&self, name: &str) -> PathBuf {
        let path = self.0.join(name);
        fs::create_dir(&path).unwrap();
        path
    }
}

impl Drop for TestRoot {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
