use std::fs;

use uuid::Uuid;

use super::{inspect_database, open_read_only};
use crate::database;

#[test]
fn untrusted_candidate_connections_disable_schema_trust_writes_and_mmap() {
    let path = std::env::temp_dir().join(format!("bodam-untrusted-{}.sqlite3", Uuid::new_v4()));
    drop(database::open(&path).unwrap());
    let connection = open_read_only(&path).unwrap();

    for (pragma, expected) in [
        ("trusted_schema", 0_i64),
        ("query_only", 1_i64),
        ("mmap_size", 0_i64),
        ("cell_size_check", 1_i64),
    ] {
        let value = connection
            .query_row(&format!("PRAGMA {pragma}"), [], |row| row.get::<_, i64>(0))
            .unwrap();
        assert_eq!(value, expected, "unexpected {pragma} value");
    }
    drop(connection);
    fs::remove_file(path).unwrap();
}

#[test]
fn future_and_drifted_migration_histories_are_rejected_without_migration() {
    let root = std::env::temp_dir().join(format!("bodam-schema-boundary-{}", Uuid::new_v4()));
    fs::create_dir(&root).unwrap();
    let future = root.join("future.sqlite3");
    let connection = database::open(&future).unwrap();
    connection
        .execute(
            "INSERT INTO bodam_schema_migrations (migration_name, checksum_sha256)
             VALUES ('20990101000000_future', ?1)",
            ["f".repeat(64)],
        )
        .unwrap();
    drop(connection);
    assert_eq!(
        inspect_database(&future, false).unwrap_err().code,
        "BACKUP_SCHEMA_INCOMPATIBLE"
    );

    let drifted = root.join("drifted.sqlite3");
    let connection = database::open(&drifted).unwrap();
    connection
        .execute(
            "UPDATE bodam_schema_migrations SET checksum_sha256 = ?1
             WHERE rowid = 1",
            ["0".repeat(64)],
        )
        .unwrap();
    drop(connection);
    assert_eq!(
        inspect_database(&drifted, false).unwrap_err().code,
        "BACKUP_SCHEMA_INCOMPATIBLE"
    );
    fs::remove_dir_all(root).unwrap();
}
