use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, OptionalExtension, Row, TransactionBehavior};
use uuid::Uuid;

use crate::coverage::CoverageRepository;
use crate::error::AppError;

use super::model::{CoverageBenchmark, CoverageBenchmarkWrite, DeletedCoverageBenchmark};

const SELECT_ACTIVE: &str = r#"
SELECT b.id, b.category_id, b.gender, b.min_age_years, b.max_age_years,
       b.adequate_min_won, b.excessive_min_won, b.created_at, b.updated_at
FROM coverage_benchmarks b
JOIN coverage_categories category ON category.id = b.category_id
WHERE b.deleted_at IS NULL AND category.deleted_at IS NULL
ORDER BY b.category_id ASC, b.min_age_years ASC,
         b.max_age_years ASC, b.id ASC
"#;

impl CoverageRepository {
    pub(crate) fn list_benchmarks(&self) -> Result<Vec<CoverageBenchmark>, AppError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(SELECT_ACTIVE)?;
        let benchmarks = statement
            .query_map([], map_benchmark)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(benchmarks)
    }

    pub(crate) fn create_benchmark(
        &self,
        input: CoverageBenchmarkWrite,
    ) -> Result<CoverageBenchmark, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_active_category(&transaction, &input.category_id)?;
        ensure_no_overlap(&transaction, &input, None)?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        transaction.execute(
            "INSERT INTO coverage_benchmarks
             (id, category_id, gender, min_age_years, max_age_years,
              adequate_min_won, excessive_min_won, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8)",
            params![
                id,
                input.category_id,
                input.gender,
                input.min_age_years,
                input.max_age_years,
                input.adequate_min_won,
                input.excessive_min_won,
                now,
            ],
        )?;
        let benchmark = find_active(&transaction, &id)?;
        transaction.commit()?;
        Ok(benchmark)
    }

    pub(crate) fn update_benchmark(
        &self,
        id: &str,
        input: CoverageBenchmarkWrite,
    ) -> Result<CoverageBenchmark, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_active_benchmark(&transaction, id)?;
        ensure_active_category(&transaction, &input.category_id)?;
        ensure_no_overlap(&transaction, &input, Some(id))?;
        let changed = transaction.execute(
            "UPDATE coverage_benchmarks SET
               category_id = ?2, gender = ?3,
               min_age_years = ?4, max_age_years = ?5,
               adequate_min_won = ?6, excessive_min_won = ?7,
               updated_at = ?8
             WHERE id = ?1 AND deleted_at IS NULL",
            params![
                id,
                input.category_id,
                input.gender,
                input.min_age_years,
                input.max_age_years,
                input.adequate_min_won,
                input.excessive_min_won,
                now_utc(),
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageBenchmarkNotFound);
        }
        let benchmark = find_active(&transaction, id)?;
        transaction.commit()?;
        Ok(benchmark)
    }

    pub(crate) fn soft_delete_benchmark(
        &self,
        id: &str,
    ) -> Result<DeletedCoverageBenchmark, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let now = now_utc();
        let changed = transaction.execute(
            "UPDATE coverage_benchmarks
             SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM coverage_categories category
                 WHERE category.id = coverage_benchmarks.category_id
                   AND category.deleted_at IS NULL
               )",
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageBenchmarkNotFound);
        }
        transaction.commit()?;
        Ok(DeletedCoverageBenchmark { id: id.to_owned() })
    }
}

fn ensure_active_category(connection: &Connection, id: &str) -> Result<(), AppError> {
    let exists = connection
        .query_row(
            "SELECT true FROM coverage_categories
             WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| row.get::<_, bool>(0),
        )
        .optional()?;
    if exists != Some(true) {
        return Err(AppError::CoverageCategoryNotFound);
    }
    Ok(())
}

fn ensure_active_benchmark(connection: &Connection, id: &str) -> Result<(), AppError> {
    let exists = connection
        .query_row(
            "SELECT true FROM coverage_benchmarks b
             JOIN coverage_categories category ON category.id = b.category_id
             WHERE b.id = ?1 AND b.deleted_at IS NULL
               AND category.deleted_at IS NULL",
            [id],
            |row| row.get::<_, bool>(0),
        )
        .optional()?;
    if exists != Some(true) {
        return Err(AppError::CoverageBenchmarkNotFound);
    }
    Ok(())
}

fn ensure_no_overlap(
    connection: &Connection,
    input: &CoverageBenchmarkWrite,
    excluded_id: Option<&str>,
) -> Result<(), AppError> {
    let overlaps = connection.query_row(
        "SELECT EXISTS(
           SELECT 1 FROM coverage_benchmarks
           WHERE category_id = ?1 AND gender = ?2 AND deleted_at IS NULL
             AND min_age_years <= ?4 AND ?3 <= max_age_years
             AND (?5 IS NULL OR id <> ?5)
         )",
        params![
            input.category_id,
            input.gender,
            input.min_age_years,
            input.max_age_years,
            excluded_id,
        ],
        |row| row.get::<_, bool>(0),
    )?;
    if overlaps {
        return Err(AppError::CoverageBenchmarkConflict);
    }
    Ok(())
}

fn find_active(connection: &Connection, id: &str) -> Result<CoverageBenchmark, AppError> {
    connection
        .query_row(
            "SELECT b.id, b.category_id, b.gender,
                    b.min_age_years, b.max_age_years,
                    b.adequate_min_won, b.excessive_min_won,
                    b.created_at, b.updated_at
             FROM coverage_benchmarks b
             JOIN coverage_categories category ON category.id = b.category_id
             WHERE b.id = ?1 AND b.deleted_at IS NULL
               AND category.deleted_at IS NULL",
            [id],
            map_benchmark,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::CoverageBenchmarkNotFound,
            _ => AppError::Database,
        })
}

fn map_benchmark(row: &Row<'_>) -> rusqlite::Result<CoverageBenchmark> {
    Ok(CoverageBenchmark {
        id: row.get(0)?,
        category_id: row.get(1)?,
        gender: row.get(2)?,
        min_age_years: row.get(3)?,
        max_age_years: row.get(4)?,
        adequate_min_won: row.get::<_, i64>(5)?.to_string(),
        excessive_min_won: row.get::<_, i64>(6)?.to_string(),
        created_at: read_utc_timestamp(row, 7)?,
        updated_at: read_utc_timestamp(row, 8)?,
    })
}

fn now_utc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}

fn read_utc_timestamp(row: &Row<'_>, index: usize) -> rusqlite::Result<String> {
    let value = row.get::<_, String>(index)?;
    normalize_utc_timestamp(&value).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(index, Type::Text, Box::new(error))
    })
}

fn normalize_utc_timestamp(value: &str) -> Result<String, chrono::ParseError> {
    if let Ok(timestamp) = DateTime::parse_from_rfc3339(value) {
        return Ok(timestamp
            .with_timezone(&Utc)
            .to_rfc3339_opts(SecondsFormat::Millis, true));
    }
    NaiveDateTime::parse_from_str(value, "%Y-%m-%d %H:%M:%S").map(|timestamp| {
        timestamp
            .and_utc()
            .to_rfc3339_opts(SecondsFormat::Millis, true)
    })
}
