use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

use serde_json::Value;
use uuid::Uuid;

use super::super::error::BackupError;
use super::super::file_ops::sync_parent;
use super::super::restore_preview_discard::RestorePreviewRemover;
use super::BackupRuntime;

#[test]
fn failed_discard_keeps_the_runtime_preview_retryable() {
    let fixture = Fixture::new();
    let mut runtime = BackupRuntime::open(
        fixture.database.clone(),
        fixture.app_data.clone(),
        "0.1.0".into(),
        None,
    )
    .unwrap();
    Arc::get_mut(&mut runtime.inner)
        .unwrap()
        .manager
        .preview_remover = Arc::new(FailOnceRemover(AtomicBool::new(true)));
    let backup = encoded(runtime.create_manual_backup().unwrap());
    let artifact = fixture
        .app_data
        .join("backups")
        .join(backup["basename"].as_str().unwrap());
    let preview = encoded(runtime.preview_restore(&artifact).unwrap());
    let token = preview["token"].as_str().unwrap();

    let error = runtime.discard_restore_preview(token).unwrap_err();

    assert_eq!(error.code, "RESTORE_FAILED");
    runtime.discard_restore_preview(token).unwrap();
    assert!(runtime.preview_restore(&artifact).is_ok());
}

fn encoded(value: impl serde::Serialize) -> Value {
    serde_json::to_value(value).unwrap()
}

struct FailOnceRemover(AtomicBool);

impl RestorePreviewRemover for FailOnceRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        if self.0.swap(false, Ordering::SeqCst) {
            return Err(io::Error::new(
                io::ErrorKind::PermissionDenied,
                "synthetic permission denial",
            ));
        }
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> Result<(), BackupError> {
        sync_parent(parent)
    }
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
    app_data: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-runtime-discard-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        drop(crate::database::open(&database).unwrap());
        let app_data = root.join("app-data");
        fs::create_dir(&app_data).unwrap();
        Self {
            root,
            database,
            app_data,
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
