use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, TimeZone, Utc};
use uuid::Uuid;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

use super::{inspect_verified_archive, write_verified_archive, DATABASE_ENTRY, MANIFEST_ENTRY};
use crate::backup::file_ops::OsAtomicReplacer;
use crate::backup::model::{BackupManifest, BackupReason, BACKUP_FORMAT_VERSION};
use crate::backup::snapshot::create_online_snapshot;
use crate::database;

#[test]
fn rejects_extra_entries_and_non_stored_database_payloads() {
    let fixture = Fixture::new();
    let (manifest, snapshot) = fixture.snapshot();
    for (name, compression, extra) in [
        ("extra", CompressionMethod::Stored, true),
        ("compressed", CompressionMethod::Deflated, false),
    ] {
        let artifact = fixture.path().join(format!("{name}.bodam-backup"));
        write_raw_archive(&artifact, &snapshot, &manifest, compression, extra);
        assert_eq!(
            inspect_verified_archive(&artifact).unwrap_err().code,
            "BACKUP_ARCHIVE_INVALID"
        );
    }
}

#[test]
fn rejects_truncation_and_manifest_checksum_tampering() {
    let fixture = Fixture::new();
    let (manifest, snapshot) = fixture.snapshot();
    let artifact = fixture.path().join("valid.bodam-backup");
    write_verified_archive(&artifact, &snapshot, &manifest, &OsAtomicReplacer).unwrap();
    let bytes = fs::read(&artifact).unwrap();
    fs::write(&artifact, &bytes[..bytes.len() / 2]).unwrap();
    assert_eq!(
        inspect_verified_archive(&artifact).unwrap_err().code,
        "BACKUP_ARCHIVE_INVALID"
    );

    let mut tampered = manifest;
    tampered.database_sha256 = "0".repeat(64);
    let artifact = fixture.path().join("tampered.bodam-backup");
    write_raw_archive(
        &artifact,
        &snapshot,
        &tampered,
        CompressionMethod::Stored,
        false,
    );
    assert_eq!(
        inspect_verified_archive(&artifact).unwrap_err().code,
        "BACKUP_CHECKSUM_MISMATCH"
    );
}

fn write_raw_archive(
    target: &Path,
    database: &Path,
    manifest: &BackupManifest,
    database_compression: CompressionMethod,
    extra: bool,
) {
    let file = File::create(target).unwrap();
    let mut writer = ZipWriter::new(file);
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);
    writer.start_file(MANIFEST_ENTRY, stored).unwrap();
    writer
        .write_all(&serde_json::to_vec(manifest).unwrap())
        .unwrap();
    writer
        .start_file(
            DATABASE_ENTRY,
            SimpleFileOptions::default().compression_method(database_compression),
        )
        .unwrap();
    writer.write_all(&fs::read(database).unwrap()).unwrap();
    if extra {
        writer.start_file("extra.txt", stored).unwrap();
        writer.write_all(b"extra").unwrap();
    }
    writer.finish().unwrap();
}

struct Fixture(PathBuf);

impl Fixture {
    fn new() -> Self {
        let path = std::env::temp_dir().join(format!("bodam-archive-{}", Uuid::new_v4()));
        fs::create_dir(&path).unwrap();
        Self(path)
    }

    fn path(&self) -> &Path {
        &self.0
    }

    fn snapshot(&self) -> (BackupManifest, PathBuf) {
        let source = self.path().join("source.sqlite3");
        drop(database::open(&source).unwrap());
        let snapshot = self
            .path()
            .join(format!("snapshot-{}.sqlite3", Uuid::new_v4()));
        let descriptor = create_online_snapshot(&source, &snapshot).unwrap();
        let manifest = BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at_utc: Utc
                .with_ymd_and_hms(2026, 8, 7, 1, 2, 3)
                .unwrap()
                .to_rfc3339_opts(SecondsFormat::Millis, true),
            local_date: "2026-08-07".into(),
            reason: BackupReason::Manual,
            app_version: "0.1.0".into(),
            schema_migration_count: descriptor.schema.migration_count,
            schema_last_migration: descriptor.schema.last_migration_name,
            database_size_bytes: descriptor.size_bytes,
            database_sha256: descriptor.sha256,
        };
        (manifest, snapshot)
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}
