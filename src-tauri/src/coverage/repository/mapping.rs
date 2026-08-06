use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::Row;

use crate::coverage::model::{Coverage, CoverageCategory};

pub(super) fn map_category(row: &Row<'_>) -> rusqlite::Result<CoverageCategory> {
    Ok(CoverageCategory {
        id: row.get(0)?,
        name: row.get(1)?,
        created_at: read_utc_timestamp(row, 2)?,
        updated_at: read_utc_timestamp(row, 3)?,
    })
}

pub(super) fn map_coverage(row: &Row<'_>) -> rusqlite::Result<Coverage> {
    Ok(Coverage {
        id: row.get(0)?,
        policy_id: row.get(1)?,
        category_id: row.get(2)?,
        amount_won: row.get::<_, i64>(3)?.to_string(),
        created_at: read_utc_timestamp(row, 4)?,
        updated_at: read_utc_timestamp(row, 5)?,
    })
}

pub(super) fn now_utc() -> String {
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
