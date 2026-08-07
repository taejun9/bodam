use std::fs;
use std::io;
use std::path::{Path, PathBuf};

use chrono::{SecondsFormat, TimeZone, Utc};
use uuid::Uuid;

use super::write_verified_archive_in;
use crate::backup::archive::inspect_verified_archive;
use crate::backup::directory_capability::DirectoryCapability;
use crate::backup::file_ops::{AtomicReplacer, OsAtomicReplacer};
use crate::backup::model::{BackupManifest, BackupReason, BACKUP_FORMAT_VERSION};
use crate::backup::snapshot::{create_online_snapshot, DatabaseDescriptor};
use crate::backup::temporary_cleanup::{OsTemporaryCleanupOps, TemporaryCleanupOps};
use crate::database;

#[cfg(any(target_os = "macos", target_os = "linux", windows))]
const IDENTITY_SWAP_HELD_SIBLING: &str = ".bodam-identity-swap-held.tmp.bodam-backup";

#[test]
fn final_directory_sync_failure_reports_failure_without_losing_the_archive() {
    let fixture = Fixture::new();
    let manifest = fixture.manifest();
    let error = write_verified_archive_in(
        &fixture.destination,
        "sync-failure.bodam-backup",
        &fixture.snapshot,
        &fixture.workspace,
        &manifest,
        &OsAtomicReplacer,
        &FailDirectorySync,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(fixture.backups.join("sync-failure.bodam-backup").is_file());
    assert_eq!(archive_temporaries(&fixture.backups), 0);
}

#[test]
fn cleanup_fault_is_fail_closed_and_leaves_recoverable_owned_temporary() {
    let fixture = Fixture::new();
    let error = write_verified_archive_in(
        &fixture.destination,
        "cleanup-failure.bodam-backup",
        &fixture.snapshot,
        &fixture.workspace,
        &fixture.manifest(),
        &OsAtomicReplacer,
        &FailRemoval,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(!fixture
        .backups
        .join("cleanup-failure.bodam-backup")
        .exists());
    assert_eq!(archive_temporaries(&fixture.backups), 1);
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
#[test]
fn path_retarget_after_final_sync_is_reported_instead_of_success() {
    let fixture = Fixture::new();
    let original = fixture.root.join("original-backups");
    let replacement = fixture.root.join("replacement-backups");
    fs::create_dir(&replacement).unwrap();
    let operations = RetargetAfterSync {
        active: fixture.backups.clone(),
        original: original.clone(),
        replacement: replacement.clone(),
    };

    let error = write_verified_archive_in(
        &fixture.destination,
        "retargeted.bodam-backup",
        &fixture.snapshot,
        &fixture.workspace,
        &fixture.manifest(),
        &OsAtomicReplacer,
        &operations,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_PATH_UNAVAILABLE");
    assert!(original.join("retargeted.bodam-backup").is_file());
    assert!(fs::read_dir(replacement).unwrap().next().is_none());
    assert!(fixture.backups.is_symlink());
}

#[cfg(any(target_os = "macos", target_os = "linux", windows))]
#[test]
fn verified_temporary_entry_swap_is_rejected_even_when_bytes_stay_valid() {
    let fixture = Fixture::new();
    let target = fixture.backups.join("identity-swap.bodam-backup");

    let error = write_verified_archive_in(
        &fixture.destination,
        "identity-swap.bodam-backup",
        &fixture.snapshot,
        &fixture.workspace,
        &fixture.manifest(),
        &PublishMutation::ReplaceWithClone,
        &OsTemporaryCleanupOps,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert!(inspect_verified_archive(&target).is_ok());
    fixture
        .destination
        .remove_regular(IDENTITY_SWAP_HELD_SIBLING)
        .unwrap();
    assert!(!fixture.backups.join(IDENTITY_SWAP_HELD_SIBLING).exists());
}

#[test]
fn final_archive_is_strictly_revalidated_after_replace() {
    let fixture = Fixture::new();
    let target = fixture.backups.join("corrupt-final.bodam-backup");

    let error = write_verified_archive_in(
        &fixture.destination,
        "corrupt-final.bodam-backup",
        &fixture.snapshot,
        &fixture.workspace,
        &fixture.manifest(),
        &PublishMutation::CorruptFinal,
        &OsTemporaryCleanupOps,
    )
    .unwrap_err();

    assert_eq!(error.code, "BACKUP_SAVE_FAILED");
    assert_eq!(fs::read(target).unwrap(), b"synthetic corrupt final");
}

enum PublishMutation {
    #[cfg(any(target_os = "macos", target_os = "linux", windows))]
    ReplaceWithClone,
    CorruptFinal,
}

impl AtomicReplacer for PublishMutation {
    fn replace(&self, source: &Path, target: &Path) -> io::Result<()> {
        fs::rename(source, target)
    }

    fn replace_in(
        &self,
        directory: &DirectoryCapability,
        source: &str,
        target: &str,
    ) -> io::Result<()> {
        let source_path = directory.path().join(source);
        #[cfg(any(target_os = "macos", target_os = "linux", windows))]
        if matches!(self, Self::ReplaceWithClone) {
            let bytes = fs::read(&source_path)?;
            directory.rename(source, IDENTITY_SWAP_HELD_SIBLING)?;
            fs::write(&source_path, bytes)?;
        }
        OsAtomicReplacer.replace_in(directory, source, target)?;
        if matches!(self, Self::CorruptFinal) {
            fs::write(directory.path().join(target), b"synthetic corrupt final")?;
        }
        Ok(())
    }
}

struct FailDirectorySync;

impl TemporaryCleanupOps for FailDirectorySync {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> io::Result<()> {
        OsTemporaryCleanupOps.sync_parent(parent)
    }

    fn sync_directory(&self, _directory: &DirectoryCapability) -> io::Result<()> {
        Err(io::Error::other("synthetic directory sync failure"))
    }
}

struct FailRemoval;

impl TemporaryCleanupOps for FailRemoval {
    fn remove_file(&self, _path: &Path) -> io::Result<()> {
        Err(io::Error::new(
            io::ErrorKind::PermissionDenied,
            "synthetic removal failure",
        ))
    }

    fn sync_parent(&self, _parent: &Path) -> io::Result<()> {
        Ok(())
    }
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
struct RetargetAfterSync {
    active: PathBuf,
    original: PathBuf,
    replacement: PathBuf,
}

#[cfg(any(target_os = "macos", target_os = "linux"))]
impl TemporaryCleanupOps for RetargetAfterSync {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> io::Result<()> {
        OsTemporaryCleanupOps.sync_parent(parent)
    }

    fn sync_directory(&self, directory: &DirectoryCapability) -> io::Result<()> {
        use std::os::unix::fs::symlink;

        directory.sync()?;
        fs::rename(&self.active, &self.original)?;
        symlink(&self.replacement, &self.active)
    }
}

struct Fixture {
    root: PathBuf,
    backups: PathBuf,
    workspace: PathBuf,
    snapshot: PathBuf,
    descriptor: DatabaseDescriptor,
    destination: DirectoryCapability,
}

impl Fixture {
    fn new() -> Self {
        let root = std::env::temp_dir().join(format!("bodam-cap-archive-{}", Uuid::new_v4()));
        let backups = root.join("backups");
        let workspace = root.join("workspace");
        fs::create_dir_all(&backups).unwrap();
        fs::create_dir(&workspace).unwrap();
        let source = root.join("source.sqlite3");
        drop(database::open(&source).unwrap());
        let snapshot = root.join("snapshot.sqlite3");
        let descriptor = create_online_snapshot(&source, &snapshot).unwrap();
        let destination = DirectoryCapability::acquire(&backups, false).unwrap();
        Self {
            root,
            backups,
            workspace,
            snapshot,
            descriptor,
            destination,
        }
    }

    fn manifest(&self) -> BackupManifest {
        BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at_utc: Utc
                .with_ymd_and_hms(2026, 8, 7, 1, 2, 3)
                .unwrap()
                .to_rfc3339_opts(SecondsFormat::Millis, true),
            local_date: "2026-08-07".into(),
            reason: BackupReason::Manual,
            app_version: "0.1.0".into(),
            schema_migration_count: self.descriptor.schema.migration_count,
            schema_last_migration: self.descriptor.schema.last_migration_name.clone(),
            database_size_bytes: self.descriptor.size_bytes,
            database_sha256: self.descriptor.sha256.clone(),
        }
    }
}

impl Drop for Fixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

fn archive_temporaries(directory: &Path) -> usize {
    fs::read_dir(directory)
        .unwrap()
        .filter_map(Result::ok)
        .filter_map(|entry| entry.file_name().into_string().ok())
        .filter(|name| name.starts_with(".bodam-backup-"))
        .count()
}
