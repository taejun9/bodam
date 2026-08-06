use std::path::{Path, PathBuf};
use std::sync::Arc;

use super::directory_capability::DirectoryCapability;
use super::file_ops::ensure_private_directory;
use super::BackupError;

pub(super) struct BackupDestination {
    configured_path: PathBuf,
    capability: Option<Arc<DirectoryCapability>>,
}

impl BackupDestination {
    pub(super) fn new(configured_path: PathBuf) -> Self {
        Self {
            configured_path,
            capability: None,
        }
    }

    pub(super) fn prepared(
        configured_path: PathBuf,
        default_path: &Path,
    ) -> Result<Self, BackupError> {
        let capability = acquire(&configured_path, default_path)?;
        Ok(Self {
            configured_path,
            capability: Some(capability),
        })
    }

    pub(super) fn capability(
        &mut self,
        default_path: &Path,
    ) -> Result<Arc<DirectoryCapability>, BackupError> {
        if let Some(capability) = &self.capability {
            return Ok(capability.clone());
        }
        let capability = acquire(&self.configured_path, default_path)?;
        self.capability = Some(capability.clone());
        Ok(capability)
    }
}

fn acquire(
    configured_path: &Path,
    default_path: &Path,
) -> Result<Arc<DirectoryCapability>, BackupError> {
    let is_default = configured_path == default_path;
    if is_default {
        ensure_private_directory(configured_path)?;
    }
    DirectoryCapability::acquire(configured_path, !is_default).map(Arc::new)
}
