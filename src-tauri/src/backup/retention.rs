use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

use chrono::DateTime;

use super::archive::ValidatedArchive;
use super::archive_capability::inspect_verified_archive_file_in;
use super::directory_capability::{DirectoryCapability, DirectoryEntryKind};
use super::error::BackupError;
use super::model::{BackupManifest, BackupStatus};
#[cfg(test)]
use super::temporary_cleanup::OsTemporaryCleanupOps;
use super::temporary_cleanup::{is_backup_archive_temporary_name, TemporaryCleanupOps};

pub(crate) const AUTOMATIC_RETENTION_LIMIT: usize = 30;

#[derive(Clone, Copy, Debug, Default, Eq, PartialEq)]
pub(crate) struct RetentionReport {
    pub removed_count: u32,
    pub warning_count: u32,
}

#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub(crate) struct BackupDirectorySummary {
    pub automatic_count: u32,
    pub last_success_at_utc: Option<String>,
}

impl BackupDirectorySummary {
    pub(crate) fn into_status(self) -> BackupStatus {
        BackupStatus {
            directory_available: true,
            automatic_count: self.automatic_count,
            last_success_at_utc: self.last_success_at_utc,
        }
    }
}

pub(super) trait RetentionRemover: Send + Sync {
    fn remove(&self, path: &Path) -> std::io::Result<()>;

    fn remove_in(&self, directory: &DirectoryCapability, basename: &str) -> std::io::Result<()> {
        self.remove(&directory.path().join(basename))
    }

    fn sync_in(&self, directory: &DirectoryCapability) -> std::io::Result<()> {
        directory.sync()?;
        directory
            .ensure_path_identity()
            .map_err(|_| std::io::Error::other("backup directory identity changed"))
    }
}

pub(super) struct OsRetentionRemover;

impl RetentionRemover for OsRetentionRemover {
    fn remove(&self, path: &Path) -> std::io::Result<()> {
        fs::remove_file(path)
    }

    fn remove_in(&self, directory: &DirectoryCapability, basename: &str) -> std::io::Result<()> {
        directory.remove_regular(basename)
    }
}

#[derive(Debug)]
pub(crate) struct VerifiedBackupCatalog {
    directory: Arc<DirectoryCapability>,
    entries: Vec<RetentionEntry>,
}

impl VerifiedBackupCatalog {
    pub(crate) fn has_automatic_for_local_date(&self, local_date: &str) -> bool {
        self.entries.iter().any(|entry| {
            entry.manifest.reason.is_automatic() && entry.manifest.local_date == local_date
        })
    }

    pub(crate) fn latest_checksum(&self) -> Option<&str> {
        self.latest()
            .map(|entry| entry.manifest.database_sha256.as_str())
    }

    pub(crate) fn summarize(&self) -> BackupDirectorySummary {
        BackupDirectorySummary {
            automatic_count: self
                .entries
                .iter()
                .filter(|entry| entry.manifest.reason.is_automatic())
                .count()
                .try_into()
                .unwrap_or(u32::MAX),
            last_success_at_utc: self
                .latest()
                .map(|entry| entry.manifest.created_at_utc.clone()),
        }
    }

    pub(crate) fn insert_verified(
        &mut self,
        archive: &ValidatedArchive,
    ) -> Result<(), BackupError> {
        let path = self.directory.path().join(&archive.basename);
        let entry = RetentionEntry::new(path, archive)?;
        self.entries.push(entry);
        Ok(())
    }

    pub(crate) fn enforce_automatic_retention(
        &mut self,
        remover: &dyn RetentionRemover,
    ) -> RetentionReport {
        let mut automatic = self
            .entries
            .iter()
            .filter(|entry| entry.manifest.reason.is_automatic())
            .collect::<Vec<_>>();
        automatic.sort_by(|left, right| left.sort_key().cmp(&right.sort_key()));
        let remove_count = automatic.len().saturating_sub(AUTOMATIC_RETENTION_LIMIT);
        let candidates = automatic
            .into_iter()
            .take(remove_count)
            .map(|entry| entry.path.clone())
            .collect::<Vec<_>>();
        let mut removed = BTreeSet::new();
        let mut report = RetentionReport::default();
        for path in candidates {
            let basename = path
                .file_name()
                .and_then(|value| value.to_str())
                .ok_or_else(|| std::io::Error::other("invalid backup basename"));
            let removed_result =
                basename.and_then(|basename| remover.remove_in(&self.directory, basename));
            match removed_result {
                Ok(()) => {
                    removed.insert(path);
                }
                Err(_) => report.warning_count += 1,
            }
        }
        if !removed.is_empty() && remover.sync_in(&self.directory).is_err() {
            report.warning_count += 1;
            return report;
        }
        report.removed_count = removed.len().try_into().unwrap_or(u32::MAX);
        self.entries.retain(|entry| !removed.contains(&entry.path));
        report
    }

    fn latest(&self) -> Option<&RetentionEntry> {
        self.entries
            .iter()
            .max_by(|left, right| left.sort_key().cmp(&right.sort_key()))
    }
}

#[cfg(test)]
pub(crate) fn scan_verified_backups(
    directory: &Path,
) -> Result<VerifiedBackupCatalog, BackupError> {
    scan_verified_backups_in(directory, directory, &OsTemporaryCleanupOps)
}

#[cfg(test)]
pub(super) fn scan_verified_backups_in(
    directory: &Path,
    workspace: &Path,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<VerifiedBackupCatalog, BackupError> {
    let directory = Arc::new(DirectoryCapability::acquire(directory, false)?);
    scan_verified_backups_from(directory, workspace, cleanup)
}

pub(super) fn scan_verified_backups_from(
    directory: Arc<DirectoryCapability>,
    workspace: &Path,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<VerifiedBackupCatalog, BackupError> {
    directory.ensure_path_identity()?;
    let mut verified = Vec::new();
    for basename in directory.entries()? {
        if let Some(entry) = validated_entry(&directory, &basename, workspace, cleanup)? {
            verified.push(entry);
        }
    }
    directory.ensure_path_identity()?;
    Ok(VerifiedBackupCatalog {
        directory,
        entries: verified,
    })
}

#[derive(Debug)]
struct RetentionEntry {
    path: PathBuf,
    basename: String,
    manifest: BackupManifest,
}

impl RetentionEntry {
    fn new(path: PathBuf, archive: &ValidatedArchive) -> Result<Self, BackupError> {
        DateTime::parse_from_rfc3339(&archive.manifest.created_at_utc)
            .map_err(|_| BackupError::archive_invalid())?;
        Ok(Self {
            path,
            basename: archive.basename.clone(),
            manifest: archive.manifest.clone(),
        })
    }

    fn sort_key(&self) -> (&str, &str) {
        (&self.manifest.created_at_utc, &self.basename)
    }
}

fn validated_entry(
    directory: &DirectoryCapability,
    basename: &str,
    workspace: &Path,
    cleanup: &dyn TemporaryCleanupOps,
) -> Result<Option<RetentionEntry>, BackupError> {
    if is_backup_archive_temporary_name(basename) {
        return Ok(None);
    }
    if Path::new(basename)
        .extension()
        .and_then(|value| value.to_str())
        != Some("bodam-backup")
    {
        return Ok(None);
    }
    if directory.entry_kind(basename)? != DirectoryEntryKind::RegularFile {
        return Ok(None);
    }
    count_archive_inspection();
    match inspect_verified_archive_file_in(directory, basename, workspace, cleanup) {
        Ok(archive) => RetentionEntry::new(directory.path().join(basename), &archive).map(Some),
        Err(error) if invalid_archive_candidate(&error) => Ok(None),
        Err(error) => Err(error),
    }
}

fn invalid_archive_candidate(error: &BackupError) -> bool {
    matches!(
        error.code,
        "BACKUP_ARCHIVE_INVALID"
            | "BACKUP_ARCHIVE_TOO_LARGE"
            | "BACKUP_CHECKSUM_MISMATCH"
            | "BACKUP_SCHEMA_INCOMPATIBLE"
            | "BACKUP_DATABASE_INVALID"
    )
}

#[cfg(test)]
thread_local! {
    static ARCHIVE_INSPECTIONS: std::cell::Cell<usize> = const { std::cell::Cell::new(0) };
}

#[cfg(test)]
fn count_archive_inspection() {
    ARCHIVE_INSPECTIONS.set(ARCHIVE_INSPECTIONS.get() + 1);
}

#[cfg(not(test))]
fn count_archive_inspection() {}

#[cfg(test)]
pub(super) fn reset_archive_inspection_count() {
    ARCHIVE_INSPECTIONS.set(0);
}

#[cfg(test)]
pub(super) fn archive_inspection_count() -> usize {
    ARCHIVE_INSPECTIONS.get()
}

#[cfg(test)]
#[path = "retention_tests.rs"]
mod tests;
