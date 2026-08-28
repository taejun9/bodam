use crate::error::AppError;

use super::model::UpdateAppSettingsInput;
use super::validation::validate_update;

fn input() -> UpdateAppSettingsInput {
    UpdateAppSettingsInput {
        theme: "light".to_owned(),
        recent_consultation_days: 30,
        unconsulted_days: 90,
        dashboard_item_limit: 10,
    }
}

#[test]
fn accepts_exact_settings_boundaries_and_equal_periods() {
    let mut lower = input();
    lower.recent_consultation_days = 1;
    lower.unconsulted_days = 1;
    lower.dashboard_item_limit = 1;
    assert!(validate_update(lower).is_ok());

    let mut upper = input();
    upper.theme = "system".to_owned();
    upper.recent_consultation_days = 365;
    upper.unconsulted_days = 3_650;
    assert!(validate_update(upper).is_ok());

    let mut dark = input();
    dark.theme = "dark".to_owned();
    assert!(validate_update(dark).is_ok());
}

#[test]
fn rejects_theme_ranges_and_overlapping_periods_without_echoing_values() {
    let rejected = "synthetic-invalid-theme-marker";
    let error = validate_update(UpdateAppSettingsInput {
        theme: rejected.to_owned(),
        recent_consultation_days: 0,
        unconsulted_days: 3_651,
        dashboard_item_limit: 11,
    })
    .expect_err("invalid settings");
    let AppError::Validation(fields) = &error else {
        panic!("expected validation error");
    };
    assert_eq!(
        fields.keys().map(String::as_str).collect::<Vec<_>>(),
        [
            "dashboardItemLimit",
            "recentConsultationDays",
            "theme",
            "unconsultedDays",
        ]
    );
    assert!(!serde_json::to_string(&error)
        .expect("serialize error")
        .contains(rejected));

    let mut overlap = input();
    overlap.recent_consultation_days = 91;
    overlap.unconsulted_days = 90;
    let AppError::Validation(fields) = validate_update(overlap).expect_err("overlap") else {
        panic!("expected validation error");
    };
    assert_eq!(fields.len(), 1);
    assert!(fields.contains_key("unconsultedDays"));
}

#[test]
fn deserialize_boundary_requires_exact_camel_case_shape() {
    let valid = r#"{
        "theme":"dark",
        "recentConsultationDays":45,
        "unconsultedDays":120,
        "dashboardItemLimit":7
    }"#;
    let parsed: UpdateAppSettingsInput = serde_json::from_str(valid).expect("valid DTO");
    assert_eq!(parsed.dashboard_item_limit, 7);

    for invalid in [
        r#"{"theme":"dark","recentConsultationDays":45,"unconsultedDays":120}"#,
        r#"{"theme":"dark","recentConsultationDays":45,"unconsultedDays":120,"dashboardItemLimit":7,"customBackupDirectory":"/blocked"}"#,
        r#"{"theme":"dark","recent_consultation_days":45,"unconsultedDays":120,"dashboardItemLimit":7}"#,
        r#"{"theme":null,"recentConsultationDays":45,"unconsultedDays":120,"dashboardItemLimit":7}"#,
    ] {
        assert!(serde_json::from_str::<UpdateAppSettingsInput>(invalid).is_err());
    }
}
