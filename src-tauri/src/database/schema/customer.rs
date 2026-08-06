use rusqlite::Connection;

use crate::error::AppError;

use super::inspection::{verify_columns, verify_indexes, ExpectedColumn};

pub(super) const OBJECTS: &[(&str, &str, &str)] = &[
    ("index", "customers_deleted_at_idx", "customers"),
    ("index", "customers_is_managed_deleted_at_idx", "customers"),
    ("index", "customers_name_deleted_at_idx", "customers"),
    ("index", "customers_status_deleted_at_idx", "customers"),
    ("table", "customers", "customers"),
];

pub(super) fn verify_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("name", "TEXT", true, None, 0),
        ("birth_date", "TEXT", false, None, 0),
        ("gender", "TEXT", false, None, 0),
        ("phone", "TEXT", false, None, 0),
        ("address", "TEXT", false, None, 0),
        ("memo", "TEXT", false, None, 0),
        ("status", "TEXT", false, None, 0),
        ("is_managed", "BOOLEAN", true, Some("true"), 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        ("customers_deleted_at_idx", &["deleted_at"]),
        ("customers_name_deleted_at_idx", &["name", "deleted_at"]),
        ("customers_status_deleted_at_idx", &["status", "deleted_at"]),
        (
            "customers_is_managed_deleted_at_idx",
            &["is_managed", "deleted_at"],
        ),
    ];
    verify_columns(connection, "customers", COLUMNS)?;
    verify_indexes(connection, "customers", INDEXES)
}
