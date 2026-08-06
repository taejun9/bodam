use super::directory_capability::{DirectoryCapability, DirectoryEntryKind};
use super::temporary_cleanup::{
    is_backup_archive_temporary_name, is_write_probe_temporary_name, TemporaryCleanupOps,
};
use super::BackupError;

pub(super) fn sweep_backup_directory_in(
    directory: &DirectoryCapability,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let mut matches = Vec::new();
    for name in directory.entries()? {
        if !is_backup_archive_temporary_name(&name) && !is_write_probe_temporary_name(&name) {
            continue;
        }
        if directory.entry_kind(&name)? != DirectoryEntryKind::RegularFile {
            return Err(BackupError::save_failed());
        }
        matches.push(name);
    }
    remove_preflighted(directory, &matches, operations)
}

#[cfg(test)]
#[path = "temporary_cleanup_capability_tests.rs"]
mod tests;

pub(super) fn cleanup_backup_archive_temporary_in(
    directory: &DirectoryCapability,
    name: &str,
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    if !is_backup_archive_temporary_name(name) {
        return Err(BackupError::save_failed());
    }
    match directory.entry_kind(name)? {
        DirectoryEntryKind::RegularFile => {
            operations
                .remove_in(directory, name)
                .map_err(|_| BackupError::save_failed())?;
        }
        DirectoryEntryKind::Missing => {}
        DirectoryEntryKind::Other => return Err(BackupError::save_failed()),
    }
    operations
        .sync_directory(directory)
        .map_err(|_| BackupError::save_failed())
}

fn remove_preflighted(
    directory: &DirectoryCapability,
    names: &[String],
    operations: &dyn TemporaryCleanupOps,
) -> Result<(), BackupError> {
    let mut failed = false;
    for name in names {
        if operations.remove_in(directory, name).is_err() {
            failed = true;
        }
    }
    if operations.sync_directory(directory).is_err() {
        failed = true;
    }
    if failed {
        Err(BackupError::save_failed())
    } else {
        Ok(())
    }
}
