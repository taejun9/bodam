use std::fmt::{Display, Formatter};

use serde::ser::{Serialize, SerializeStruct, Serializer};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct BackupError {
    pub code: &'static str,
    pub message: &'static str,
}

impl BackupError {
    pub(crate) const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }

    pub(crate) const fn busy() -> Self {
        Self::new(
            "BACKUP_OPERATION_BUSY",
            "다른 백업 또는 복원 작업이 진행 중입니다.",
        )
    }

    pub(crate) const fn path_unavailable() -> Self {
        Self::new(
            "BACKUP_PATH_UNAVAILABLE",
            "백업 위치를 안전하게 사용할 수 없습니다.",
        )
    }

    pub(crate) const fn snapshot_failed() -> Self {
        Self::new(
            "BACKUP_SNAPSHOT_FAILED",
            "로컬 데이터의 일관된 백업을 만들지 못했습니다.",
        )
    }

    pub(crate) const fn archive_invalid() -> Self {
        Self::new(
            "BACKUP_ARCHIVE_INVALID",
            "올바른 BODAM 백업 파일이 아닙니다.",
        )
    }

    pub(crate) const fn archive_too_large() -> Self {
        Self::new(
            "BACKUP_ARCHIVE_TOO_LARGE",
            "백업 파일 크기가 허용 범위를 초과했습니다.",
        )
    }

    pub(crate) const fn checksum_mismatch() -> Self {
        Self::new(
            "BACKUP_CHECKSUM_MISMATCH",
            "백업 파일의 무결성을 확인할 수 없습니다.",
        )
    }

    pub(crate) const fn schema_incompatible() -> Self {
        Self::new(
            "BACKUP_SCHEMA_INCOMPATIBLE",
            "이 앱에서 복원할 수 없는 데이터베이스 버전입니다.",
        )
    }

    pub(crate) const fn database_invalid() -> Self {
        Self::new(
            "BACKUP_DATABASE_INVALID",
            "백업 데이터베이스가 손상되었거나 일관되지 않습니다.",
        )
    }

    pub(crate) const fn save_failed() -> Self {
        Self::new(
            "BACKUP_SAVE_FAILED",
            "백업 파일을 안전하게 저장하지 못했습니다.",
        )
    }

    pub(crate) const fn restore_failed() -> Self {
        Self::new(
            "RESTORE_FAILED",
            "현재 데이터를 보존한 채 복원을 완료하지 못했습니다.",
        )
    }

    pub(crate) const fn restore_rollback_failed() -> Self {
        Self::new(
            "RESTORE_ROLLBACK_FAILED",
            "복원 실패 뒤 기존 데이터베이스를 되돌리지 못했습니다.",
        )
    }

    pub(crate) const fn preview_unavailable() -> Self {
        Self::new(
            "RESTORE_PREVIEW_UNAVAILABLE",
            "선택한 복원 미리보기가 더 이상 유효하지 않습니다.",
        )
    }
}

impl Display for BackupError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for BackupError {}

impl Serialize for BackupError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let mut state = serializer.serialize_struct("CommandError", 2)?;
        state.serialize_field("code", self.code)?;
        state.serialize_field("message", self.message)?;
        state.end()
    }
}
