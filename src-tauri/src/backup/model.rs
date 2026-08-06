use chrono::{DateTime, NaiveDate, SecondsFormat, Utc};
use serde::{Deserialize, Serialize};

use super::error::BackupError;

pub(crate) const BACKUP_FORMAT_VERSION: u32 = 1;

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum BackupReason {
    Daily,
    Exit,
    Manual,
    PreRestore,
}

impl BackupReason {
    pub(crate) const fn is_automatic(self) -> bool {
        matches!(self, Self::Daily | Self::Exit)
    }

    pub(crate) const fn filename_segment(self) -> &'static str {
        match self {
            Self::Daily => "daily",
            Self::Exit => "exit",
            Self::Manual => "manual",
            Self::PreRestore => "pre-restore",
        }
    }
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct BackupManifest {
    pub format_version: u32,
    pub created_at_utc: String,
    pub local_date: String,
    pub reason: BackupReason,
    pub app_version: String,
    pub schema_migration_count: u32,
    pub schema_last_migration: String,
    pub database_size_bytes: u64,
    pub database_sha256: String,
}

impl BackupManifest {
    pub(crate) fn validate(&self, max_database_bytes: u64) -> Result<(), BackupError> {
        let local_date_is_canonical = NaiveDate::parse_from_str(&self.local_date, "%Y-%m-%d")
            .is_ok_and(|parsed| parsed.format("%Y-%m-%d").to_string() == self.local_date);
        if !is_canonical_utc_millis(&self.created_at_utc)
            || !local_date_is_canonical
            || self.format_version != BACKUP_FORMAT_VERSION
            || self.app_version.is_empty()
            || self.app_version.len() > 64
            || self.app_version.chars().any(char::is_control)
            || self.schema_migration_count == 0
            || self.schema_last_migration.is_empty()
            || self.schema_last_migration.len() > 200
            || self.database_size_bytes < 100
            || self.database_size_bytes > max_database_bytes
            || self.database_sha256.len() != 64
            || !self
                .database_sha256
                .bytes()
                .all(|byte| byte.is_ascii_digit() || matches!(byte, b'a'..=b'f'))
        {
            return Err(BackupError::archive_invalid());
        }
        Ok(())
    }
}

pub(super) fn is_canonical_utc_millis(value: &str) -> bool {
    DateTime::parse_from_rfc3339(value).is_ok_and(|parsed| {
        parsed
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Millis, true)
            == value
    })
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupResult {
    pub created: bool,
    pub basename: Option<String>,
    pub manifest: Option<BackupManifest>,
    pub retention_warning_count: u32,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct BackupStatus {
    pub directory_available: bool,
    pub automatic_count: u32,
    pub last_success_at_utc: Option<String>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct RestorePreview {
    pub token: String,
    pub basename: String,
    pub created_at_utc: String,
    pub reason: BackupReason,
    pub app_version: String,
    pub schema_migration_count: u32,
    pub schema_last_migration: String,
}

#[derive(Clone, Copy, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum RestoreOutcome {
    Restored,
    RolledBack,
}

#[derive(Clone, Debug, Deserialize, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct StartupRestoreStatus {
    pub outcome: RestoreOutcome,
    pub backup_basename: String,
    pub completed_at_utc: String,
}

#[cfg(test)]
mod tests {
    use super::{BackupManifest, BackupReason, BACKUP_FORMAT_VERSION};

    fn manifest() -> BackupManifest {
        BackupManifest {
            format_version: BACKUP_FORMAT_VERSION,
            created_at_utc: "2026-08-07T01:02:03.004Z".into(),
            local_date: "2026-08-07".into(),
            reason: BackupReason::Daily,
            app_version: "0.1.0".into(),
            schema_migration_count: 9,
            schema_last_migration: "20260806080000_add_app_settings".into(),
            database_size_bytes: 4096,
            database_sha256: "a".repeat(64),
        }
    }

    #[test]
    fn strict_manifest_accepts_only_bounded_utc_v1_metadata() {
        assert!(manifest().validate(8192).is_ok());
        for timestamp in [
            "2026-08-07T10:02:03+09:00",
            "2026-08-07T01:02:03.004+00:00",
            "2026-08-07T01:02Z",
            "2026-08-07T01:02:03Z",
            "2026-08-07T01:02:03.04Z",
            "2026-08-07T01:02:03.0040Z",
        ] {
            let mut invalid = manifest();
            invalid.created_at_utc = timestamp.into();
            assert_eq!(
                invalid.validate(8192).unwrap_err().code,
                "BACKUP_ARCHIVE_INVALID",
                "accepted noncanonical timestamp {timestamp}"
            );
        }
        let json = serde_json::to_string(&manifest()).unwrap();
        let with_extra = json.replace('{', "{\"path\":\"private\",");
        assert!(serde_json::from_str::<BackupManifest>(&with_extra).is_err());
    }

    #[test]
    fn strict_manifest_requires_a_canonical_local_date() {
        for local_date in [
            "2026-8-07",
            "2026-08-7",
            "2026- 8- 7",
            " 2026-08-07",
            "2026-08-07 ",
            "2026-02-29",
        ] {
            let mut invalid = manifest();
            invalid.local_date = local_date.into();
            assert_eq!(
                invalid.validate(8192).unwrap_err().code,
                "BACKUP_ARCHIVE_INVALID",
                "accepted noncanonical local date {local_date:?}"
            );
        }
    }
}
