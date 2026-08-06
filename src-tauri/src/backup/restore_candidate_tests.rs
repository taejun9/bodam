use std::fs;
use std::path::PathBuf;

use rusqlite::{params, Connection};
use uuid::Uuid;

use super::prepare_working_database;
use crate::backup::BackupRuntime;
use crate::database;

#[test]
fn host_local_backup_paths_are_cleared_before_install() {
    for injected in [
        "/synthetic/other-device/backups",
        r"\\synthetic-server\private-share",
        "relative/backups",
        "/synthetic/control\nbackups",
    ] {
        let fixture = Fixture::new();
        let connection = database::open(&fixture.database).unwrap();
        connection
            .execute(
                "UPDATE app_settings SET custom_backup_directory = ?1 WHERE id = 1",
                params![injected],
            )
            .unwrap();
        drop(connection);

        let descriptor = prepare_working_database(&fixture.database).unwrap();

        assert!(descriptor.size_bytes > 0);
        assert_eq!(stored_directory(&fixture.database), None, "{injected:?}");
        let runtime = BackupRuntime::open(
            fixture.database.clone(),
            fixture.root.clone(),
            "0.1.0".into(),
            None,
        )
        .unwrap();
        runtime.load_status().unwrap();
    }
}

fn stored_directory(path: &PathBuf) -> Option<String> {
    Connection::open(path)
        .unwrap()
        .query_row(
            "SELECT custom_backup_directory FROM app_settings WHERE id = 1",
            [],
            |row| row.get(0),
        )
        .unwrap()
}

struct Fixture {
    root: PathBuf,
    database: PathBuf,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-candidate-{}", Uuid::new_v4()));
        fs::create_dir(&root).unwrap();
        let database = root.join("bodam.sqlite3");
        drop(database::open(&database).unwrap());
        Self { root, database }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}
