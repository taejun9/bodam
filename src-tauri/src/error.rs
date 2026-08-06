use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

use serde::ser::{Serialize, SerializeStruct, Serializer};

#[derive(Debug, PartialEq, Eq)]
pub enum AppError {
    Validation(BTreeMap<String, String>),
    CustomerNotFound,
    InsurancePolicyNotFound,
    Database,
    Migration,
    MigrationDrift,
    StateUnavailable,
}

impl AppError {
    fn code(&self) -> &'static str {
        match self {
            Self::Validation(_) => "VALIDATION_ERROR",
            Self::CustomerNotFound => "CUSTOMER_NOT_FOUND",
            Self::InsurancePolicyNotFound => "INSURANCE_POLICY_NOT_FOUND",
            Self::Database => "DATABASE_ERROR",
            Self::Migration => "DATABASE_MIGRATION_ERROR",
            Self::MigrationDrift => "DATABASE_MIGRATION_DRIFT",
            Self::StateUnavailable => "APPLICATION_STATE_UNAVAILABLE",
        }
    }

    fn user_message(&self) -> &'static str {
        match self {
            Self::Validation(_) => "입력값을 확인해 주세요.",
            Self::CustomerNotFound => "고객을 찾을 수 없습니다.",
            Self::InsurancePolicyNotFound => "보험계약을 찾을 수 없습니다.",
            Self::Database => "데이터를 처리하지 못했습니다. 다시 시도해 주세요.",
            Self::Migration | Self::MigrationDrift => "로컬 데이터베이스를 준비하지 못했습니다.",
            Self::StateUnavailable => "앱 상태를 불러오지 못했습니다.",
        }
    }
}

impl Display for AppError {
    fn fmt(&self, formatter: &mut Formatter<'_>) -> std::fmt::Result {
        formatter.write_str(self.user_message())
    }
}

impl std::error::Error for AppError {}

impl Serialize for AppError {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: Serializer,
    {
        let has_fields = matches!(self, Self::Validation(_));
        let mut state = serializer.serialize_struct("CommandError", 2 + usize::from(has_fields))?;
        state.serialize_field("code", self.code())?;
        state.serialize_field("message", self.user_message())?;
        if let Self::Validation(fields) = self {
            state.serialize_field("fields", fields)?;
        }
        state.end()
    }
}

impl From<rusqlite::Error> for AppError {
    fn from(_: rusqlite::Error) -> Self {
        Self::Database
    }
}
