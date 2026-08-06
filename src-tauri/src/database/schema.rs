mod consultation;
mod coverage;
mod coverage_benchmark;
mod customer;
mod data_exchange;
mod family;
mod inspection;
mod insurance;
mod schedule;
mod settings;

use rusqlite::Connection;

use crate::error::AppError;

use inspection::{runtime_objects, verify_columns, ExpectedColumn};

pub(super) fn verify_registered_version(
    connection: &Connection,
    applied_count: usize,
) -> Result<(), AppError> {
    let groups = [
        customer::OBJECTS,
        insurance::OBJECTS,
        coverage::OBJECTS,
        family::OBJECTS,
        consultation::OBJECTS,
        coverage_benchmark::OBJECTS,
        schedule::OBJECTS,
        data_exchange::OBJECTS,
        settings::OBJECTS,
    ];
    if applied_count > groups.len() {
        return Err(AppError::MigrationDrift);
    }
    let mut expected = groups[..applied_count]
        .iter()
        .flat_map(|objects| owned_objects(objects))
        .collect::<Vec<_>>();
    expected.sort();
    if runtime_objects(connection)? != expected {
        return Err(AppError::MigrationDrift);
    }
    if applied_count >= 1 {
        customer::verify_schema(connection)?;
    }
    if applied_count >= 2 {
        insurance::verify_schema(connection)?;
    }
    if applied_count >= 3 {
        coverage::verify_schema(connection)?;
    }
    if applied_count >= 4 {
        family::verify_schema(connection)?;
    }
    if applied_count >= 5 {
        consultation::verify_schema(connection)?;
    }
    if applied_count >= 6 {
        coverage_benchmark::verify_schema(connection)?;
    }
    if applied_count >= 7 {
        schedule::verify_schema(connection)?;
    }
    if applied_count >= 8 {
        data_exchange::verify_schema(connection)?;
    }
    if applied_count >= 9 {
        settings::verify_schema(connection)?;
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

fn owned_objects(objects: &[(&str, &str, &str)]) -> Vec<(String, String, String)> {
    objects
        .iter()
        .map(|(kind, name, table)| ((*kind).into(), (*name).into(), (*table).into()))
        .collect()
}

#[cfg(test)]
pub(super) fn verify_customer_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    customer::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_insurance_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    insurance::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_coverage_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    coverage::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_family_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    family::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_consultation_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    consultation::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_coverage_benchmark_schema_for_test(
    connection: &Connection,
) -> Result<(), AppError> {
    coverage_benchmark::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_schedule_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    schedule::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_data_exchange_schema_for_test(
    connection: &Connection,
) -> Result<(), AppError> {
    data_exchange::verify_schema(connection)
}

#[cfg(test)]
pub(super) fn verify_settings_schema_for_test(connection: &Connection) -> Result<(), AppError> {
    settings::verify_schema(connection)
}
