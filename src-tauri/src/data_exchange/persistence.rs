use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection};

use crate::error::AppError;

use super::model::ImportSourceCells;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImportSourceKey {
    pub policy_id: String,
    pub policy_number: Option<String>,
    pub updated_at: String,
}

pub(crate) fn list_source_keys(connection: &Connection) -> Result<Vec<ImportSourceKey>, AppError> {
    let mut statement = connection.prepare(
        "SELECT policy_id, policy_number, updated_at
         FROM insurance_policy_import_sources ORDER BY policy_id ASC",
    )?;
    let sources = statement
        .query_map([], |row| {
            Ok(ImportSourceKey {
                policy_id: row.get(0)?,
                policy_number: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(sources)
}

pub(crate) fn upsert_source(
    connection: &Connection,
    policy_id: &str,
    cells: &ImportSourceCells,
) -> Result<(), AppError> {
    let now = Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true);
    connection.execute(
        r#"INSERT INTO insurance_policy_import_sources (
               policy_id, no, collection_reflected_on, affiliation, manager,
               collection_code, contract, insurer, product_name, policy_number,
               contracted_on, status, final_payment_month, payment_sequence,
               payment_premium, contractor, insured, coverage_starts_on,
               coverage_ends_on, collection_method, payment_term,
               original_recruiter_name, created_at, updated_at
           ) VALUES (
               ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12,
               ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?23
           )
           ON CONFLICT(policy_id) DO UPDATE SET
               no = excluded.no,
               collection_reflected_on = excluded.collection_reflected_on,
               affiliation = excluded.affiliation,
               manager = excluded.manager,
               collection_code = excluded.collection_code,
               contract = excluded.contract,
               insurer = excluded.insurer,
               product_name = excluded.product_name,
               policy_number = excluded.policy_number,
               contracted_on = excluded.contracted_on,
               status = excluded.status,
               final_payment_month = excluded.final_payment_month,
               payment_sequence = excluded.payment_sequence,
               payment_premium = excluded.payment_premium,
               contractor = excluded.contractor,
               insured = excluded.insured,
               coverage_starts_on = excluded.coverage_starts_on,
               coverage_ends_on = excluded.coverage_ends_on,
               collection_method = excluded.collection_method,
               payment_term = excluded.payment_term,
               original_recruiter_name = excluded.original_recruiter_name,
               updated_at = excluded.updated_at"#,
        params![
            policy_id,
            &cells.no,
            &cells.collection_reflected_on,
            &cells.affiliation,
            &cells.manager,
            &cells.collection_code,
            &cells.contract,
            &cells.insurer,
            &cells.product_name,
            &cells.policy_number,
            &cells.contracted_on,
            &cells.status,
            &cells.final_payment_month,
            &cells.payment_sequence,
            &cells.payment_premium,
            &cells.contractor,
            &cells.insured,
            &cells.coverage_starts_on,
            &cells.coverage_ends_on,
            &cells.collection_method,
            &cells.payment_term,
            &cells.original_recruiter_name,
            now,
        ],
    )?;
    Ok(())
}
