use std::ffi::OsString;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::{Path, PathBuf};
use std::thread;
use std::time::{Duration, Instant};

use rusqlite::backup::{Backup, StepResult};
use rusqlite::{Connection, OpenFlags};
use sha2::{Digest, Sha256};

use crate::database::{self, RegisteredSchemaVersion};

use super::error::BackupError;

const PAGES_PER_STEP: i32 = 256;
const STEP_PAUSE: Duration = Duration::from_millis(10);
const BUSY_PAUSE: Duration = Duration::from_millis(25);
const BACKUP_DEADLINE: Duration = Duration::from_secs(30);

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct DatabaseDescriptor {
    pub size_bytes: u64,
    pub sha256: String,
    pub schema: RegisteredSchemaVersion,
}

pub(crate) fn create_online_snapshot(
    source_path: &Path,
    destination_path: &Path,
) -> Result<DatabaseDescriptor, BackupError> {
    validate_regular_source(source_path)?;
    let mut guard = NewDatabaseFile::create(destination_path)?;
    guard.close();
    let source = open_read_only(source_path)?;
    database::verify_current(&source).map_err(|_| BackupError::schema_incompatible())?;
    verify_sqlite(&source)?;
    let mut destination =
        Connection::open(destination_path).map_err(|_| BackupError::snapshot_failed())?;

    {
        let backup =
            Backup::new(&source, &mut destination).map_err(|_| BackupError::snapshot_failed())?;
        run_bounded(&backup, BACKUP_DEADLINE)?;
    }
    destination
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|_| BackupError::snapshot_failed())?;
    database::verify_current(&destination).map_err(|_| BackupError::schema_incompatible())?;
    verify_sqlite(&destination)?;
    drop(destination);
    remove_sidecars(destination_path)?;
    sync_file(destination_path)?;
    let descriptor = inspect_database(destination_path, true)?;
    guard.keep();
    Ok(descriptor)
}

pub(crate) fn inspect_database(
    path: &Path,
    require_current: bool,
) -> Result<DatabaseDescriptor, BackupError> {
    validate_regular_source(path)?;
    let connection = open_read_only(path)?;
    let schema = if require_current {
        database::verify_current(&connection)
    } else {
        database::verify_registered_prefix(&connection)
    }
    .map_err(|_| BackupError::schema_incompatible())?;
    verify_sqlite(&connection)?;
    drop(connection);
    let (size_bytes, sha256) = hash_file(path)?;
    Ok(DatabaseDescriptor {
        size_bytes,
        sha256,
        schema,
    })
}

pub(crate) fn migrate_working_database(path: &Path) -> Result<DatabaseDescriptor, BackupError> {
    validate_regular_source(path)?;
    let connection = database::open(path).map_err(|_| BackupError::schema_incompatible())?;
    connection
        .pragma_update(None, "journal_mode", "DELETE")
        .map_err(|_| BackupError::restore_failed())?;
    verify_sqlite(&connection)?;
    drop(connection);
    remove_sidecars(path)?;
    sync_file(path)?;
    inspect_database(path, true)
}

pub(crate) fn copy_database(source: &Path, destination: &Path) -> Result<(), BackupError> {
    validate_regular_source(source)?;
    let mut input = File::open(source).map_err(|_| BackupError::restore_failed())?;
    let mut guard = NewDatabaseFile::create(destination)?;
    let output = guard.file_mut()?;
    std::io::copy(&mut input, output).map_err(|_| BackupError::restore_failed())?;
    output.flush().map_err(|_| BackupError::restore_failed())?;
    output
        .sync_all()
        .map_err(|_| BackupError::restore_failed())?;
    guard.close();
    guard.keep();
    Ok(())
}

fn run_bounded(backup: &Backup<'_, '_>, deadline: Duration) -> Result<(), BackupError> {
    let started = Instant::now();
    loop {
        if started.elapsed() >= deadline {
            return Err(BackupError::snapshot_failed());
        }
        let result = backup
            .step(PAGES_PER_STEP)
            .map_err(|_| BackupError::snapshot_failed())?;
        match result {
            StepResult::Done => return Ok(()),
            StepResult::More => thread::sleep(STEP_PAUSE),
            StepResult::Busy | StepResult::Locked => thread::sleep(BUSY_PAUSE),
            _ => return Err(BackupError::snapshot_failed()),
        }
    }
}

fn verify_sqlite(connection: &Connection) -> Result<(), BackupError> {
    let integrity = connection
        .query_row("PRAGMA integrity_check", [], |row| row.get::<_, String>(0))
        .map_err(|_| BackupError::database_invalid())?;
    if integrity != "ok" {
        return Err(BackupError::database_invalid());
    }
    let mut statement = connection
        .prepare("PRAGMA foreign_key_check")
        .map_err(|_| BackupError::database_invalid())?;
    if statement
        .query([])
        .and_then(|mut rows| rows.next().map(|row| row.is_some()))
        .map_err(|_| BackupError::database_invalid())?
    {
        return Err(BackupError::database_invalid());
    }
    Ok(())
}

fn open_read_only(path: &Path) -> Result<Connection, BackupError> {
    let flags = OpenFlags::SQLITE_OPEN_READ_ONLY | OpenFlags::SQLITE_OPEN_NO_MUTEX;
    let connection =
        Connection::open_with_flags(path, flags).map_err(|_| BackupError::database_invalid())?;
    connection
        .busy_timeout(Duration::from_secs(5))
        .map_err(|_| BackupError::database_invalid())?;
    connection
        .execute_batch(
            "PRAGMA trusted_schema = OFF;
             PRAGMA query_only = ON;
             PRAGMA mmap_size = 0;
             PRAGMA cell_size_check = ON;",
        )
        .map_err(|_| BackupError::database_invalid())?;
    Ok(connection)
}

fn validate_regular_source(path: &Path) -> Result<(), BackupError> {
    let metadata = fs::symlink_metadata(path).map_err(|_| BackupError::path_unavailable())?;
    if !path.is_absolute() || !metadata.file_type().is_file() || metadata.file_type().is_symlink() {
        return Err(BackupError::path_unavailable());
    }
    Ok(())
}

fn hash_file(path: &Path) -> Result<(u64, String), BackupError> {
    let mut file = File::open(path).map_err(|_| BackupError::database_invalid())?;
    let mut digest = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|_| BackupError::database_invalid())?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(BackupError::database_invalid)?;
        digest.update(&buffer[..read]);
    }
    Ok((total, hex_digest(digest.finalize().as_slice())))
}

fn hex_digest(bytes: &[u8]) -> String {
    use std::fmt::Write as _;

    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(encoded, "{byte:02x}");
    }
    encoded
}

pub(crate) fn remove_sidecars(path: &Path) -> Result<(), BackupError> {
    for suffix in ["-wal", "-shm", "-journal"] {
        let sidecar = suffixed_path(path, suffix);
        match fs::remove_file(sidecar) {
            Ok(()) => {}
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
            Err(_) => return Err(BackupError::restore_failed()),
        }
    }
    Ok(())
}

fn suffixed_path(path: &Path, suffix: &str) -> PathBuf {
    let mut value: OsString = path.as_os_str().to_owned();
    value.push(suffix);
    PathBuf::from(value)
}

pub(super) fn sync_file(path: &Path) -> Result<(), BackupError> {
    OpenOptions::new()
        .write(true)
        .open(path)
        .and_then(|file| file.sync_all())
        .map_err(|_| BackupError::snapshot_failed())
}

struct NewDatabaseFile {
    path: PathBuf,
    file: Option<File>,
    keep: bool,
}

impl NewDatabaseFile {
    fn create(path: &Path) -> Result<Self, BackupError> {
        let mut options = OpenOptions::new();
        options.read(true).write(true).create_new(true);
        #[cfg(unix)]
        {
            use std::os::unix::fs::OpenOptionsExt;
            options.mode(0o600);
        }
        let file = options
            .open(path)
            .map_err(|_| BackupError::path_unavailable())?;
        Ok(Self {
            path: path.to_owned(),
            file: Some(file),
            keep: false,
        })
    }

    fn file_mut(&mut self) -> Result<&mut File, BackupError> {
        self.file.as_mut().ok_or_else(BackupError::restore_failed)
    }

    fn close(&mut self) {
        self.file.take();
    }

    fn keep(mut self) {
        self.keep = true;
    }
}

impl Drop for NewDatabaseFile {
    fn drop(&mut self) {
        if !self.keep {
            self.file.take();
            let _ = fs::remove_file(&self.path);
        }
    }
}

#[cfg(test)]
#[path = "snapshot_tests.rs"]
mod tests;
