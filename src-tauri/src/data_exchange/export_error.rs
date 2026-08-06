use serde::Serialize;
use std::fmt;

use crate::error::AppError;

#[derive(Clone, Copy, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ContractExportError {
    pub(crate) code: &'static str,
    pub(crate) message: &'static str,
}

impl ContractExportError {
    pub(crate) const fn new(code: &'static str, message: &'static str) -> Self {
        Self { code, message }
    }

    pub(crate) const fn data_unavailable() -> Self {
        Self::new(
            "EXPORT_DATA_UNAVAILABLE",
            "내보낼 계약 정보를 불러오지 못했습니다.",
        )
    }

    pub(crate) const fn generation_failed() -> Self {
        Self::new(
            "EXPORT_GENERATION_FAILED",
            "계약 파일을 안전하게 만들지 못했습니다.",
        )
    }

    pub(crate) const fn verification_failed() -> Self {
        Self::new(
            "EXPORT_VERIFICATION_FAILED",
            "생성한 계약 파일의 내용을 확인하지 못했습니다.",
        )
    }

    pub(crate) const fn file_too_large() -> Self {
        Self::new(
            "EXPORT_FILE_TOO_LARGE",
            "생성 파일은 10 MiB 이하여야 합니다.",
        )
    }

    pub(crate) const fn logical_text_too_large() -> Self {
        Self::new(
            "EXPORT_LOGICAL_TEXT_LIMIT_EXCEEDED",
            "내보낼 원본 텍스트 범위를 초과했습니다.",
        )
    }
}

impl fmt::Display for ContractExportError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.message)
    }
}

impl std::error::Error for ContractExportError {}

impl From<AppError> for ContractExportError {
    fn from(_: AppError) -> Self {
        Self::data_unavailable()
    }
}
