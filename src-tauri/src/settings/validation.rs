use std::collections::BTreeMap;

use crate::error::AppError;

use super::model::{AppSettingsWrite, UpdateAppSettingsInput};

pub(crate) const MIN_RECENT_DAYS: i64 = 1;
pub(crate) const MAX_RECENT_DAYS: i64 = 365;
pub(crate) const MIN_UNCONSULTED_DAYS: i64 = 1;
pub(crate) const MAX_UNCONSULTED_DAYS: i64 = 3_650;
pub(crate) const MIN_DASHBOARD_ITEMS: i64 = 1;
pub(crate) const MAX_DASHBOARD_ITEMS: i64 = 10;

pub(crate) fn validate_update(input: UpdateAppSettingsInput) -> Result<AppSettingsWrite, AppError> {
    validate_values(
        input.theme,
        input.recent_consultation_days,
        input.unconsulted_days,
        input.dashboard_item_limit,
    )
}

pub(crate) fn validate_values(
    theme: String,
    recent_consultation_days: i64,
    unconsulted_days: i64,
    dashboard_item_limit: i64,
) -> Result<AppSettingsWrite, AppError> {
    let mut fields = BTreeMap::new();
    if theme != "light" && theme != "dark" {
        fields.insert(
            "theme".to_owned(),
            "테마는 라이트 또는 다크만 선택할 수 있습니다.".to_owned(),
        );
    }
    validate_range(
        "recentConsultationDays",
        recent_consultation_days,
        MIN_RECENT_DAYS,
        MAX_RECENT_DAYS,
        "최근 상담 일수",
        &mut fields,
    );
    validate_range(
        "unconsultedDays",
        unconsulted_days,
        MIN_UNCONSULTED_DAYS,
        MAX_UNCONSULTED_DAYS,
        "미상담 기준 일수",
        &mut fields,
    );
    validate_range(
        "dashboardItemLimit",
        dashboard_item_limit,
        MIN_DASHBOARD_ITEMS,
        MAX_DASHBOARD_ITEMS,
        "카드별 표시 건수",
        &mut fields,
    );
    if (MIN_RECENT_DAYS..=MAX_RECENT_DAYS).contains(&recent_consultation_days)
        && (MIN_UNCONSULTED_DAYS..=MAX_UNCONSULTED_DAYS).contains(&unconsulted_days)
        && unconsulted_days < recent_consultation_days
    {
        fields.insert(
            "unconsultedDays".to_owned(),
            "미상담 기준 일수는 최근 상담 일수 이상이어야 합니다.".to_owned(),
        );
    }
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(AppSettingsWrite {
        theme,
        recent_consultation_days,
        unconsulted_days,
        dashboard_item_limit,
    })
}

fn validate_range(
    field: &str,
    value: i64,
    minimum: i64,
    maximum: i64,
    label: &str,
    fields: &mut BTreeMap<String, String>,
) {
    if !(minimum..=maximum).contains(&value) {
        fields.insert(
            field.to_owned(),
            format!("{label}는 {minimum}부터 {maximum} 사이의 정수여야 합니다."),
        );
    }
}
