use rusqlite::{params, Connection, OptionalExtension, TransactionBehavior};
use uuid::Uuid;

use crate::error::AppError;
use crate::family::model::{DeletedFamilyMembership, FamilyMembership, MembershipWrite};

use super::families::ensure_active_family;
use super::mapping::{map_membership, now_utc};
use super::FamilyRepository;

const SELECT_ACTIVE_BY_FAMILY: &str = r#"
SELECT m.id, m.family_id, m.customer_id, m.relationship_name,
       m.created_at, m.updated_at
FROM family_memberships m
JOIN families f ON f.id = m.family_id
JOIN customers c ON c.id = m.customer_id
WHERE m.family_id = ?1
  AND f.deleted_at IS NULL
  AND c.deleted_at IS NULL
  AND m.deleted_at IS NULL
ORDER BY c.name COLLATE NOCASE ASC, c.id ASC
"#;

impl FamilyRepository {
    pub(crate) fn list_memberships(
        &self,
        family_id: &str,
    ) -> Result<Vec<FamilyMembership>, AppError> {
        let connection = self.lock()?;
        ensure_active_family(&connection, family_id)?;
        let mut statement = connection.prepare(SELECT_ACTIVE_BY_FAMILY)?;
        let memberships = statement
            .query_map([family_id], map_membership)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(memberships)
    }

    pub(crate) fn add_membership(
        &self,
        family_id: &str,
        input: MembershipWrite,
    ) -> Result<FamilyMembership, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_active_family(&transaction, family_id)?;
        ensure_active_customer(&transaction, &input.customer_id)?;

        let existing = transaction
            .query_row(
                "SELECT id, deleted_at IS NULL FROM family_memberships
                 WHERE family_id = ?1 AND customer_id = ?2",
                params![family_id, input.customer_id],
                |row| Ok((row.get::<_, String>(0)?, row.get::<_, bool>(1)?)),
            )
            .optional()?;
        let id = match existing {
            Some((_, true)) => return Err(AppError::FamilyMembershipConflict),
            Some((id, false)) => {
                transaction.execute(
                    "UPDATE family_memberships
                     SET relationship_name = ?2, updated_at = ?3, deleted_at = NULL
                     WHERE id = ?1 AND deleted_at IS NOT NULL",
                    params![id, input.relationship_name, now_utc()],
                )?;
                id
            }
            None => {
                let id = Uuid::new_v4().to_string();
                let now = now_utc();
                transaction.execute(
                    "INSERT INTO family_memberships
                     (id, family_id, customer_id, relationship_name, created_at, updated_at)
                     VALUES (?1, ?2, ?3, ?4, ?5, ?5)",
                    params![
                        id,
                        family_id,
                        input.customer_id,
                        input.relationship_name,
                        now
                    ],
                )?;
                id
            }
        };
        let membership = find_active_membership(&transaction, family_id, &id)?;
        transaction.commit()?;
        Ok(membership)
    }

    pub(crate) fn update_membership(
        &self,
        family_id: &str,
        id: &str,
        relationship_name: Option<String>,
    ) -> Result<FamilyMembership, AppError> {
        let connection = self.lock()?;
        ensure_active_family(&connection, family_id)?;
        let changed = connection.execute(
            "UPDATE family_memberships
             SET relationship_name = ?3, updated_at = ?4
             WHERE id = ?2 AND family_id = ?1 AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM customers c
                 WHERE c.id = family_memberships.customer_id
                   AND c.deleted_at IS NULL
               )",
            params![family_id, id, relationship_name, now_utc()],
        )?;
        if changed == 0 {
            return Err(AppError::FamilyMembershipNotFound);
        }
        find_active_membership(&connection, family_id, id)
    }

    pub(crate) fn soft_delete_membership(
        &self,
        family_id: &str,
        id: &str,
    ) -> Result<DeletedFamilyMembership, AppError> {
        let connection = self.lock()?;
        ensure_active_family(&connection, family_id)?;
        let now = now_utc();
        let changed = connection.execute(
            "UPDATE family_memberships
             SET deleted_at = ?3, updated_at = ?3
             WHERE id = ?2 AND family_id = ?1 AND deleted_at IS NULL
               AND EXISTS (
                 SELECT 1 FROM customers c
                 WHERE c.id = family_memberships.customer_id
                   AND c.deleted_at IS NULL
               )",
            params![family_id, id, now],
        )?;
        if changed == 0 {
            return Err(AppError::FamilyMembershipNotFound);
        }
        Ok(DeletedFamilyMembership { id: id.to_owned() })
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

fn find_active_membership(
    connection: &Connection,
    family_id: &str,
    id: &str,
) -> Result<FamilyMembership, AppError> {
    connection
        .query_row(
            "SELECT m.id, m.family_id, m.customer_id, m.relationship_name,
                    m.created_at, m.updated_at
             FROM family_memberships m
             JOIN families f ON f.id = m.family_id
             JOIN customers c ON c.id = m.customer_id
             WHERE m.family_id = ?1 AND m.id = ?2
               AND f.deleted_at IS NULL
               AND c.deleted_at IS NULL
               AND m.deleted_at IS NULL",
            params![family_id, id],
            map_membership,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::FamilyMembershipNotFound,
            _ => AppError::Database,
        })
}
