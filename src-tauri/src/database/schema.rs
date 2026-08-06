mod coverage;
mod family;
mod inspection;

use rusqlite::Connection;

use crate::error::AppError;

use inspection::{runtime_objects, verify_columns, verify_indexes, ExpectedColumn};

const CUSTOMER_OBJECTS: &[(&str, &str, &str)] = &[
    ("index", "customers_deleted_at_idx", "customers"),
    ("index", "customers_is_managed_deleted_at_idx", "customers"),
    ("index", "customers_name_deleted_at_idx", "customers"),
    ("index", "customers_status_deleted_at_idx", "customers"),
    ("table", "customers", "customers"),
];

const INSURANCE_OBJECTS: &[(&str, &str, &str)] = &[
    (
        "index",
        "insurance_policies_customer_id_deleted_at_idx",
        "insurance_policies",
    ),
    (
        "index",
        "insurance_policies_matures_on_deleted_at_idx",
        "insurance_policies",
    ),
    ("table", "insurance_policies", "insurance_policies"),
];

pub(super) fn verify_registered_version(
    connection: &Connection,
    applied_count: usize,
) -> Result<(), AppError> {
    let expected = match applied_count {
        0 => Vec::new(),
        1 => owned_objects(CUSTOMER_OBJECTS),
        2 => {
            let mut objects = owned_objects(CUSTOMER_OBJECTS);
            objects.extend(owned_objects(INSURANCE_OBJECTS));
            objects.sort();
            objects
        }
        3 => {
            let mut objects = owned_objects(CUSTOMER_OBJECTS);
            objects.extend(owned_objects(INSURANCE_OBJECTS));
            objects.extend(owned_objects(coverage::OBJECTS));
            objects.sort();
            objects
        }
        4 => {
            let mut objects = owned_objects(CUSTOMER_OBJECTS);
            objects.extend(owned_objects(INSURANCE_OBJECTS));
            objects.extend(owned_objects(coverage::OBJECTS));
            objects.extend(owned_objects(family::OBJECTS));
            objects.sort();
            objects
        }
        _ => return Err(AppError::MigrationDrift),
    };
    if runtime_objects(connection)? != expected {
        return Err(AppError::MigrationDrift);
    }
    if applied_count >= 1 {
        verify_customer_schema(connection)?;
    }
    if applied_count >= 2 {
        verify_insurance_policy_schema(connection)?;
    }
    if applied_count >= 3 {
        coverage::verify_schema(connection)?;
    }
    if applied_count >= 4 {
        family::verify_schema(connection)?;
    }
    Ok(())
}

pub(super) fn verify_history_table(connection: &Connection) -> Result<(), AppError> {
    const EXPECTED: &[ExpectedColumn] = &[
        ("migration_name", "TEXT", true, None, 1),
        ("checksum_sha256", "TEXT", true, None, 0),
        ("applied_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
    ];
    verify_columns(connection, "bodam_schema_migrations", EXPECTED)
}

fn verify_customer_schema(connection: &Connection) -> Result<(), AppError> {
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

fn verify_insurance_policy_schema(connection: &Connection) -> Result<(), AppError> {
    const COLUMNS: &[ExpectedColumn] = &[
        ("id", "TEXT", true, None, 1),
        ("customer_id", "TEXT", true, None, 0),
        ("insurer", "TEXT", true, None, 0),
        ("product_name", "TEXT", true, None, 0),
        ("joined_on", "TEXT", false, None, 0),
        ("coverage_term", "TEXT", false, None, 0),
        ("payment_term", "TEXT", false, None, 0),
        ("monthly_premium_won", "BIGINT", true, None, 0),
        ("disclosure_plan", "TEXT", false, None, 0),
        ("matures_on", "TEXT", false, None, 0),
        ("renewable", "BOOLEAN", true, Some("false"), 0),
        ("status", "TEXT", false, None, 0),
        ("is_included", "BOOLEAN", true, Some("true"), 0),
        ("created_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("updated_at", "DATETIME", true, Some("CURRENT_TIMESTAMP"), 0),
        ("deleted_at", "DATETIME", false, None, 0),
    ];
    const INDEXES: &[(&str, &[&str])] = &[
        (
            "insurance_policies_customer_id_deleted_at_idx",
            &["customer_id", "deleted_at"],
        ),
        (
            "insurance_policies_matures_on_deleted_at_idx",
            &["matures_on", "deleted_at"],
        ),
    ];
    verify_columns(connection, "insurance_policies", COLUMNS)?;
    verify_indexes(connection, "insurance_policies", INDEXES)?;
    verify_insurance_foreign_key(connection)
}

fn verify_insurance_foreign_key(connection: &Connection) -> Result<(), AppError> {
    let mut statement = connection
        .prepare(
            "SELECT \"table\", \"from\", \"to\", on_update, on_delete, \"match\"
             FROM pragma_foreign_key_list('insurance_policies') ORDER BY id, seq",
        )
        .map_err(|_| AppError::Migration)?;
    let keys = statement
        .query_map([], |row| {
            Ok((
                row.get::<_, String>(0)?,
                row.get::<_, String>(1)?,
                row.get::<_, String>(2)?,
                row.get::<_, String>(3)?,
                row.get::<_, String>(4)?,
                row.get::<_, String>(5)?,
            ))
        })
        .map_err(|_| AppError::Migration)?
        .collect::<Result<Vec<_>, _>>()
        .map_err(|_| AppError::Migration)?;
    let expected = vec![(
        "customers".to_owned(),
        "customer_id".to_owned(),
        "id".to_owned(),
        "CASCADE".to_owned(),
        "RESTRICT".to_owned(),
        "NONE".to_owned(),
    )];
    if keys != expected {
        return Err(AppError::MigrationDrift);
    }
    Ok(())
}

fn owned_objects(objects: &[(&str, &str, &str)]) -> Vec<(String, String, String)> {
    objects
        .iter()
        .map(|(kind, name, table)| ((*kind).into(), (*name).into(), (*table).into()))
        .collect()
}

#[cfg(test)]
pub(super) fn verify_customer_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    verify_customer_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_insurance_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    verify_insurance_policy_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_coverage_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    coverage::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_family_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    family::verify_schema(connection)
}
