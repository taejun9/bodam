use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::coverage::model::{Coverage, CoverageWrite, DeletedCoverage};
use crate::error::AppError;

use super::categories::ensure_active_category;
use super::mapping::{map_coverage, now_utc};
use super::CoverageRepository;

const SELECT_ACTIVE_BY_CUSTOMER: &str = r#"
SELECT v.id, v.policy_id, v.category_id, v.amount_won,
       v.created_at, v.updated_at
FROM coverages v
JOIN insurance_policies p ON p.id = v.policy_id
JOIN customers c ON c.id = p.customer_id
JOIN coverage_categories category ON category.id = v.category_id
WHERE p.customer_id = ?1
  AND c.deleted_at IS NULL
  AND p.deleted_at IS NULL
  AND category.deleted_at IS NULL
  AND v.deleted_at IS NULL
ORDER BY v.updated_at DESC, v.id ASC
"#;

impl CoverageRepository {
    pub(crate) fn list(&self, customer_id: &str) -> Result<Vec<Coverage>, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        let mut statement = connection.prepare(SELECT_ACTIVE_BY_CUSTOMER)?;
        let coverages = statement
            .query_map([customer_id], map_coverage)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        Ok(coverages)
    }

    pub(crate) fn create(
        &self,
        customer_id: &str,
        policy_id: &str,
        input: CoverageWrite,
    ) -> Result<Coverage, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        ensure_active_policy(&connection, customer_id, policy_id)?;
        ensure_active_category(&connection, &input.category_id)?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        let changed = connection.execute(
            "INSERT INTO coverages
             (id, policy_id, category_id, amount_won, created_at, updated_at)
             SELECT ?3, p.id, category.id, ?5, ?6, ?6
             FROM insurance_policies p
             JOIN customers c ON c.id = p.customer_id
             JOIN coverage_categories category ON category.id = ?4
             WHERE p.customer_id = ?1 AND p.id = ?2
               AND c.deleted_at IS NULL
               AND p.deleted_at IS NULL
               AND category.deleted_at IS NULL",
            params![
                customer_id,
                policy_id,
                id,
                input.category_id,
                input.amount_won,
                now
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageNotFound);
        }
        find_active(&connection, customer_id, &id)
    }

    pub(crate) fn update(
        &self,
        customer_id: &str,
        id: &str,
        input: CoverageWrite,
    ) -> Result<Coverage, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        ensure_active_coverage(&connection, customer_id, id)?;
        ensure_active_category(&connection, &input.category_id)?;
        let changed = connection.execute(
            "UPDATE coverages
             SET category_id = ?3, amount_won = ?4, updated_at = ?5
             WHERE id = ?2 AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM insurance_policies p
                 JOIN customers c ON c.id = p.customer_id
                 WHERE p.id = coverages.policy_id
                   AND p.customer_id = ?1
                   AND c.deleted_at IS NULL
                   AND p.deleted_at IS NULL
               )
               AND EXISTS (
                 SELECT 1 FROM coverage_categories old_category
                 WHERE old_category.id = coverages.category_id
                   AND old_category.deleted_at IS NULL
               )
               AND EXISTS (
                 SELECT 1 FROM coverage_categories new_category
                 WHERE new_category.id = ?3
                   AND new_category.deleted_at IS NULL
               )",
            params![
                customer_id,
                id,
                input.category_id,
                input.amount_won,
                now_utc()
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageNotFound);
        }
        find_active(&connection, customer_id, id)
    }

    pub(crate) fn soft_delete(
        &self,
        customer_id: &str,
        id: &str,
    ) -> Result<DeletedCoverage, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        ensure_active_coverage(&connection, customer_id, id)?;
        let now = now_utc();
        let changed = connection.execute(
            "UPDATE coverages
             SET deleted_at = ?3, updated_at = ?3
             WHERE id = ?2 AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM insurance_policies p
                 JOIN customers c ON c.id = p.customer_id
                 WHERE p.id = coverages.policy_id
                   AND p.customer_id = ?1
                   AND c.deleted_at IS NULL
                   AND p.deleted_at IS NULL
               )
               AND EXISTS (
                 SELECT 1 FROM coverage_categories category
                 WHERE category.id = coverages.category_id
                   AND category.deleted_at IS NULL
               )",
            params![customer_id, id, now],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageNotFound);
        }
        Ok(DeletedCoverage { id: id.to_owned() })
    }
}

fn ensure_active_customer(connection: &Connection, id: &str) -> Result<(), AppError> {
    let exists = connection
        .query_row(
            "SELECT true FROM customers WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| row.get::<_, bool>(0),
        )
        .optional()?;
    if exists != Some(true) {
        return Err(AppError::CustomerNotFound);
    }
    Ok(())
}

fn ensure_active_policy(
    connection: &Connection,
    customer_id: &str,
    policy_id: &str,
) -> Result<(), AppError> {
    let exists = connection
        .query_row(
            "SELECT true FROM insurance_policies
             WHERE id = ?1 AND customer_id = ?2 AND deleted_at IS NULL",
            params![policy_id, customer_id],
            |row| row.get::<_, bool>(0),
        )
        .optional()?;
    if exists != Some(true) {
        return Err(AppError::InsurancePolicyNotFound);
    }
    Ok(())
}

fn ensure_active_coverage(
    connection: &Connection,
    customer_id: &str,
    id: &str,
) -> Result<(), AppError> {
    find_active(connection, customer_id, id).map(|_| ())
}

fn find_active(connection: &Connection, customer_id: &str, id: &str) -> Result<Coverage, AppError> {
    connection
        .query_row(
            "SELECT v.id, v.policy_id, v.category_id, v.amount_won,
                    v.created_at, v.updated_at
             FROM coverages v
             JOIN insurance_policies p ON p.id = v.policy_id
             JOIN customers c ON c.id = p.customer_id
             JOIN coverage_categories category ON category.id = v.category_id
             WHERE v.id = ?2 AND p.customer_id = ?1
               AND c.deleted_at IS NULL
               AND p.deleted_at IS NULL
               AND category.deleted_at IS NULL
               AND v.deleted_at IS NULL",
            params![customer_id, id],
            map_coverage,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::CoverageNotFound,
            _ => AppError::Database,
        })
}
