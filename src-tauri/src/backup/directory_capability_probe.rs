use uuid::Uuid;

use super::directory_capability::DirectoryCapability;
use super::BackupError;

impl DirectoryCapability {
    pub(super) fn probe_writable(&self) -> Result<(), BackupError> {
        let name = format!(".bodam-write-check-{}.tmp", Uuid::new_v4());
        drop(self.create_new(&name)?);
        self.remove_regular(&name)
            .map_err(|_| BackupError::path_unavailable())?;
        self.sync().map_err(|_| BackupError::path_unavailable())
    }
}
