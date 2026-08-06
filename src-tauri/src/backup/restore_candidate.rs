use std::fs::File;
use std::path::Path;

use crate::database;

use super::error::BackupError;
use super::snapshot::{
    inspect_database, migrate_working_database, remove_sidecars, DatabaseDescriptor,
};

pub(super) fn prepare_working_database(path: &Path) -> Result<DatabaseDescriptor, BackupError> {
    migrate_working_database(path)?;
    let connection = database::open(path).map_err(|_| BackupError::restore_failed())?;
    let changed = connection
        .execute(
            "UPDATE app_settings SET custom_backup_directory = NULL WHERE id = 1",
            [],
        )
        .map_err(|_| BackupError::restore_failed())?;
    if changed != 1 {
        return Err(BackupError::restore_failed());
    }
    connection
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|_| BackupError::restore_failed())?;
    drop(connection);
    remove_sidecars(path)?;
    File::open(path)
        .and_then(|file| file.sync_all())
        .map_err(|_| BackupError::restore_failed())?;
    inspect_database(path, true)
}

#[cfg(test)]
#[path = "restore_candidate_tests.rs"]
mod tests;
