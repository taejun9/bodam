use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{DeletedInsurancePolicy, InsurancePolicy, InsurancePolicyWrite};

const SELECT_ACTIVE_BY_CUSTOMER: &str = r#"
SELECT p.id, p.customer_id, p.insurer, p.product_name, p.joined_on,
       p.coverage_term, p.payment_term, p.monthly_premium_won,
       p.disclosure_plan, p.matures_on, p.renewable, p.status,
       p.is_included, p.created_at, p.updated_at
FROM insurance_policies p
JOIN customers c ON c.id = p.customer_id
WHERE p.customer_id = ?1
  AND p.deleted_at IS NULL
  AND c.deleted_at IS NULL
ORDER BY p.updated_at DESC, p.id ASC
"#;

pub(crate) struct InsurancePolicyRepository {
    connection: Mutex<Connection>,
}

impl InsurancePolicyRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    pub(crate) fn list(&self, customer_id: &str) -> Result<Vec<InsurancePolicy>, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        let mut statement = connection.prepare(SELECT_ACTIVE_BY_CUSTOMER)?;
        let policies = statement
            .query_map([customer_id], map_policy)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        Ok(policies)
    }

    pub(crate) fn create(
        &self,
        customer_id: &str,
        input: InsurancePolicyWrite,
    ) -> Result<InsurancePolicy, AppError> {
        let connection = self.lock()?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        let changed = connection.execute(
            r#"INSERT INTO insurance_policies (
                   id, customer_id, insurer, product_name, joined_on,
                   coverage_term, payment_term, monthly_premium_won,
                   disclosure_plan, matures_on, renewable, status,
                   is_included, created_at, updated_at
               )
               SELECT ?2, id, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10,
                      ?11, ?12, ?13, ?14, ?14
               FROM customers
               WHERE id = ?1 AND deleted_at IS NULL"#,
            params![
                customer_id,
                id,
                input.insurer,
                input.product_name,
                input.joined_on,
                input.coverage_term,
                input.payment_term,
                input.monthly_premium_won,
                input.disclosure_plan,
                input.matures_on,
                input.renewable,
                input.status,
                input.is_included,
                now,
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CustomerNotFound);
        }
        find_active(&connection, &id)
    }

    pub(crate) fn update(
        &self,
        id: &str,
        input: InsurancePolicyWrite,
    ) -> Result<InsurancePolicy, AppError> {
        let connection = self.lock()?;
        let changed = connection.execute(
            r#"UPDATE insurance_policies SET
                   insurer = ?2, product_name = ?3, joined_on = ?4,
                   coverage_term = ?5, payment_term = ?6,
                   monthly_premium_won = ?7, disclosure_plan = ?8,
                   matures_on = ?9, renewable = ?10, status = ?11,
                   is_included = ?12, updated_at = ?13
               WHERE id = ?1 AND deleted_at IS NULL
                 AND EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = insurance_policies.customer_id
                     AND c.deleted_at IS NULL
                 )"#,
            params![
                id,
                input.insurer,
                input.product_name,
                input.joined_on,
                input.coverage_term,
                input.payment_term,
                input.monthly_premium_won,
                input.disclosure_plan,
                input.matures_on,
                input.renewable,
                input.status,
                input.is_included,
                now_utc(),
            ],
        )?;
        if changed == 0 {
            return Err(AppError::InsurancePolicyNotFound);
        }
        find_active(&connection, id)
    }

    pub(crate) fn soft_delete(&self, id: &str) -> Result<DeletedInsurancePolicy, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            r#"UPDATE insurance_policies
               SET deleted_at = ?2, updated_at = ?2
               WHERE id = ?1 AND deleted_at IS NULL
                 AND EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = insurance_policies.customer_id
                     AND c.deleted_at IS NULL
                 )"#,
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::InsurancePolicyNotFound);
        }
        Ok(DeletedInsurancePolicy { id: id.to_owned() })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }
}

fn ensure_active_customer(connection: &Connection, customer_id: &str) -> Result<(), AppError> {
    let exists = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM customers WHERE id = ?1 AND deleted_at IS NULL)",
        [customer_id],
        |row| row.get::<_, bool>(0),
    )?;
    if !exists {
        return Err(AppError::CustomerNotFound);
    }
    Ok(())
}

fn find_active(connection: &Connection, id: &str) -> Result<InsurancePolicy, AppError> {
    connection
        .query_row(
            r#"SELECT p.id, p.customer_id, p.insurer, p.product_name, p.joined_on,
                      p.coverage_term, p.payment_term, p.monthly_premium_won,
                      p.disclosure_plan, p.matures_on, p.renewable, p.status,
                      p.is_included, p.created_at, p.updated_at
               FROM insurance_policies p
               JOIN customers c ON c.id = p.customer_id
               WHERE p.id = ?1 AND p.deleted_at IS NULL AND c.deleted_at IS NULL"#,
            [id],
            map_policy,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::InsurancePolicyNotFound,
            _ => AppError::Database,
        })
}

fn map_policy(row: &Row<'_>) -> rusqlite::Result<InsurancePolicy> {
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

fn now_utc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
