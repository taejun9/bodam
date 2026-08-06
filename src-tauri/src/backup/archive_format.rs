use std::collections::BTreeSet;
use std::fs::File;
use std::io::{Read, Write};
use std::path::Path;

use sha2::{Digest, Sha256};
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipArchive, ZipWriter};

use super::archive::{ValidatedArchive, MAX_ARCHIVE_BYTES, MAX_DATABASE_BYTES};
use super::file_ops::SecureFile;
use super::model::BackupManifest;
use super::snapshot::{inspect_database, DatabaseDescriptor};
use super::BackupError;

pub(super) const MANIFEST_ENTRY: &str = "manifest.json";
pub(super) const DATABASE_ENTRY: &str = "database.sqlite3";
const MAX_MANIFEST_BYTES: u64 = 16 * 1024;

pub(super) fn write_archive_payload(
    file: File,
    snapshot_path: &Path,
    manifest: &BackupManifest,
) -> Result<(), BackupError> {
    let mut writer = ZipWriter::new(file);
    let options = SimpleFileOptions::default()
        .compression_method(CompressionMethod::Stored)
        .unix_permissions(0o600);
    let manifest_bytes = serde_json::to_vec(manifest).map_err(|_| BackupError::save_failed())?;
    writer
        .start_file(MANIFEST_ENTRY, options)
        .map_err(|_| BackupError::save_failed())?;
    writer
        .write_all(&manifest_bytes)
        .map_err(|_| BackupError::save_failed())?;
    writer
        .start_file(DATABASE_ENTRY, options)
        .map_err(|_| BackupError::save_failed())?;
    let mut source = File::open(snapshot_path).map_err(|_| BackupError::save_failed())?;
    std::io::copy(&mut source, &mut writer).map_err(|_| BackupError::save_failed())?;
    let mut file = writer.finish().map_err(|_| BackupError::save_failed())?;
    file.flush().map_err(|_| BackupError::save_failed())?;
    file.sync_all().map_err(|_| BackupError::save_failed())
}

pub(super) fn extract_verified_archive_file(
    file: File,
    basename: String,
    destination: &Path,
) -> Result<ValidatedArchive, BackupError> {
    extract_verified_archive_file_with_handle(file, basename, destination)
        .map(|(archive, _file)| archive)
}

pub(super) fn extract_verified_archive_file_with_handle(
    file: File,
    basename: String,
    destination: &Path,
) -> Result<(ValidatedArchive, File), BackupError> {
    if file
        .metadata()
        .map_err(|_| BackupError::archive_invalid())?
        .len()
        > MAX_ARCHIVE_BYTES
    {
        return Err(BackupError::archive_too_large());
    }
    let mut archive = ZipArchive::new(file).map_err(|_| BackupError::archive_invalid())?;
    preflight(&mut archive)?;
    let manifest = read_manifest(&mut archive)?;
    manifest.validate(MAX_DATABASE_BYTES)?;
    let mut entry = archive
        .by_name(DATABASE_ENTRY)
        .map_err(|_| BackupError::archive_invalid())?;
    if entry.size() != manifest.database_size_bytes {
        return Err(BackupError::checksum_mismatch());
    }
    let mut guard = SecureFile::create(destination)?;
    let mut digest = Sha256::new();
    let mut total = 0_u64;
    let mut buffer = [0_u8; 64 * 1024];
    loop {
        let read = entry
            .read(&mut buffer)
            .map_err(|_| BackupError::archive_invalid())?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(BackupError::archive_too_large)?;
        if total > MAX_DATABASE_BYTES {
            return Err(BackupError::archive_too_large());
        }
        digest.update(&buffer[..read]);
        guard
            .file_mut()?
            .write_all(&buffer[..read])
            .map_err(|_| BackupError::save_failed())?;
    }
    if total != manifest.database_size_bytes
        || hex_digest(&digest.finalize()) != manifest.database_sha256
    {
        return Err(BackupError::checksum_mismatch());
    }
    drop(entry);
    let output = guard.file_mut()?;
    output.flush().map_err(|_| BackupError::save_failed())?;
    output.sync_all().map_err(|_| BackupError::save_failed())?;
    guard.close();
    let database = inspect_database(destination, false)?;
    verify_manifest_database(&manifest, &database)?;
    guard.keep();
    let file = archive.into_inner();
    Ok((
        ValidatedArchive {
            manifest,
            database,
            basename,
        },
        file,
    ))
}

fn preflight(archive: &mut ZipArchive<File>) -> Result<(), BackupError> {
    if archive.len() != 2
        || archive
            .has_overlapping_files()
            .map_err(|_| BackupError::archive_invalid())?
    {
        return Err(BackupError::archive_invalid());
    }
    let mut names = BTreeSet::new();
    for index in 0..archive.len() {
        let file = archive
            .by_index_raw(index)
            .map_err(|_| BackupError::archive_invalid())?;
        if file.encrypted()
            || file.is_symlink()
            || file.enclosed_name().is_none()
            || file.compression() != CompressionMethod::Stored
            || file.compressed_size() != file.size()
            || !names.insert(file.name().to_owned())
        {
            return Err(BackupError::archive_invalid());
        }
        match file.name() {
            MANIFEST_ENTRY if file.size() <= MAX_MANIFEST_BYTES => {}
            DATABASE_ENTRY if file.size() <= MAX_DATABASE_BYTES => {}
            MANIFEST_ENTRY | DATABASE_ENTRY => return Err(BackupError::archive_too_large()),
            _ => return Err(BackupError::archive_invalid()),
        }
    }
    Ok(())
}

fn read_manifest(archive: &mut ZipArchive<File>) -> Result<BackupManifest, BackupError> {
    let mut entry = archive
        .by_name(MANIFEST_ENTRY)
        .map_err(|_| BackupError::archive_invalid())?;
    let mut bytes = Vec::with_capacity(entry.size() as usize);
    entry
        .read_to_end(&mut bytes)
        .map_err(|_| BackupError::archive_invalid())?;
    serde_json::from_slice(&bytes).map_err(|_| BackupError::archive_invalid())
}

pub(super) fn verify_manifest_database(
    manifest: &BackupManifest,
    database: &DatabaseDescriptor,
) -> Result<(), BackupError> {
    if manifest.database_size_bytes != database.size_bytes
        || manifest.database_sha256 != database.sha256
        || manifest.schema_migration_count != database.schema.migration_count
        || manifest.schema_last_migration != database.schema.last_migration_name
    {
        return Err(BackupError::checksum_mismatch());
    }
    Ok(())
}

fn hex_digest(bytes: &[u8]) -> String {
    use std::fmt::Write as _;

    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(encoded, "{byte:02x}");
    }
    encoded
}
