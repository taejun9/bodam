use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::Row;

use super::model::InsurancePolicy;

pub(super) fn map_policy(row: &Row<'_>) -> rusqlite::Result<InsurancePolicy> {
    Ok(InsurancePolicy {
        id: row.get(0)?,
        customer_id: row.get(1)?,
        insurer: row.get(2)?,
        product_name: row.get(3)?,
        joined_on: row.get(4)?,
        coverage_term: row.get(5)?,
        payment_term: row.get(6)?,
        monthly_premium_won: row.get::<_, i64>(7)?.to_string(),
        disclosure_plan: row.get(8)?,
        matures_on: row.get(9)?,
        renewable: row.get(10)?,
        status: row.get(11)?,
        is_included: row.get(12)?,
        created_at: read_utc_timestamp(row, 13)?,
        updated_at: read_utc_timestamp(row, 14)?,
    })
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

pub(super) fn now_utc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
