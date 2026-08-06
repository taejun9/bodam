use std::collections::BTreeMap;
use std::fmt::{Display, Formatter};

use serde::ser::{Serialize, SerializeStruct, Serializer};

#[derive(Debug, PartialEq, Eq)]
pub enum AppError {
    Validation(BTreeMap<String, String>),
    CustomerNotFound,
    ConsultationNotFound,
    ScheduleNotFound,
    InsurancePolicyNotFound,
    CoverageCategoryNotFound,
    CoverageNotFound,
    CoverageBenchmarkNotFound,
    CoverageBenchmarkConflict,
    FamilyNotFound,
    FamilyMembershipNotFound,
    FamilyMembershipConflict,
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
            Self::ConsultationNotFound => "CONSULTATION_NOT_FOUND",
            Self::ScheduleNotFound => "SCHEDULE_NOT_FOUND",
            Self::InsurancePolicyNotFound => "INSURANCE_POLICY_NOT_FOUND",
            Self::CoverageCategoryNotFound => "COVERAGE_CATEGORY_NOT_FOUND",
            Self::CoverageNotFound => "COVERAGE_NOT_FOUND",
            Self::CoverageBenchmarkNotFound => "COVERAGE_BENCHMARK_NOT_FOUND",
            Self::CoverageBenchmarkConflict => "COVERAGE_BENCHMARK_CONFLICT",
            Self::FamilyNotFound => "FAMILY_NOT_FOUND",
            Self::FamilyMembershipNotFound => "FAMILY_MEMBERSHIP_NOT_FOUND",
            Self::FamilyMembershipConflict => "FAMILY_MEMBERSHIP_CONFLICT",
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
            Self::ConsultationNotFound => "상담을 찾을 수 없습니다.",
            Self::ScheduleNotFound => "일정을 찾을 수 없습니다.",
            Self::InsurancePolicyNotFound => "보험계약을 찾을 수 없습니다.",
            Self::CoverageCategoryNotFound => "보장 카테고리를 찾을 수 없습니다.",
            Self::CoverageNotFound => "보장을 찾을 수 없습니다.",
            Self::CoverageBenchmarkNotFound => "보장 기준을 찾을 수 없습니다.",
            Self::CoverageBenchmarkConflict => "같은 조건에서 나이 구간이 겹칩니다.",
            Self::FamilyNotFound => "가족을 찾을 수 없습니다.",
            Self::FamilyMembershipNotFound => "가족 구성원을 찾을 수 없습니다.",
            Self::FamilyMembershipConflict => "이미 등록된 가족 구성원입니다.",
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
