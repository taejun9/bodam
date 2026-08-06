use std::fs;
use std::io;
use std::path::Path;

use super::error::BackupError;
use super::file_ops::sync_parent;
use super::restore::PreparedRestore;

pub(super) trait RestorePreviewRemover: Send + Sync {
    fn remove_file(&self, path: &Path) -> io::Result<()>;
    fn sync_parent(&self, parent: &Path) -> Result<(), BackupError>;
}

pub(super) struct OsRestorePreviewRemover;

impl RestorePreviewRemover for OsRestorePreviewRemover {
    fn remove_file(&self, path: &Path) -> io::Result<()> {
        fs::remove_file(path)
    }

    fn sync_parent(&self, parent: &Path) -> Result<(), BackupError> {
        sync_parent(parent)
    }
}

pub(crate) fn discard_prepared(
    prepared: &PreparedRestore,
    remover: &dyn RestorePreviewRemover,
) -> Result<(), BackupError> {
    let path = &prepared.staged_archive;
    let parent = path.parent().ok_or_else(BackupError::restore_failed)?;
    match fs::symlink_metadata(path) {
        Ok(metadata) => {
            if !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
                return Err(BackupError::restore_failed());
            }
            remover
                .remove_file(path)
                .map_err(|_| BackupError::restore_failed())?;
        }
        // A prior attempt may have unlinked the file before its parent sync failed.
        Err(error) if error.kind() == io::ErrorKind::NotFound => {}
        Err(_) => return Err(BackupError::restore_failed()),
    }
    remover
        .sync_parent(parent)
        .map_err(|_| BackupError::restore_failed())
}
