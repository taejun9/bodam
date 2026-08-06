use rusqlite::{params, Connection, OptionalExtension};
use uuid::Uuid;

use crate::error::AppError;
use crate::family::model::{DeletedFamily, Family};

use super::mapping::{map_family, now_utc};
use super::FamilyRepository;

const SELECT_ACTIVE: &str = r#"
SELECT id, name, created_at, updated_at
FROM families
WHERE deleted_at IS NULL
ORDER BY name COLLATE NOCASE ASC, id ASC
"#;

const SEARCH_ACTIVE: &str = r#"
SELECT id, name, created_at, updated_at
FROM families
WHERE deleted_at IS NULL
  AND name COLLATE NOCASE LIKE ?1 ESCAPE '\'
ORDER BY name COLLATE NOCASE ASC, id ASC
"#;

impl FamilyRepository {
    pub(crate) fn list(&self, search: Option<String>) -> Result<Vec<Family>, AppError> {
        let connection = self.lock()?;
        if let Some(value) = search {
            let pattern = format!("%{}%", escape_like(&value));
            collect_families(&connection, SEARCH_ACTIVE, [pattern])
        } else {
            let mut statement = connection.prepare(SELECT_ACTIVE)?;
            let families = statement
                .query_map([], map_family)?
                .collect::<Result<Vec<_>, _>>()?;
            Ok(families)
        }
    }

    pub(crate) fn create(&self, name: String) -> Result<Family, AppError> {
        let connection = self.lock()?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        connection.execute(
            "INSERT INTO families (id, name, created_at, updated_at)
             VALUES (?1, ?2, ?3, ?3)",
            params![id, name, now],
        )?;
        find_active_family(&connection, &id)
    }

    pub(crate) fn update(&self, id: &str, name: String) -> Result<Family, AppError> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE families SET name = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, name, now_utc()],
        )?;
        if changed == 0 {
            return Err(AppError::FamilyNotFound);
        }
        find_active_family(&connection, id)
    }

    pub(crate) fn soft_delete(&self, id: &str) -> Result<DeletedFamily, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            "UPDATE families SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::FamilyNotFound);
        }
        Ok(DeletedFamily { id: id.to_owned() })
    }
}

pub(super) fn ensure_active_family(connection: &Connection, id: &str) -> Result<(), AppError> {
    let exists = connection
        .query_row(
            "SELECT true FROM families WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            |row| row.get::<_, bool>(0),
        )
        .optional()?;
    if exists != Some(true) {
        return Err(AppError::FamilyNotFound);
    }
    Ok(())
}

fn find_active_family(connection: &Connection, id: &str) -> Result<Family, AppError> {
    connection
        .query_row(
            "SELECT id, name, created_at, updated_at
             FROM families WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            map_family,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::FamilyNotFound,
            _ => AppError::Database,
        })
}

fn collect_families(
    connection: &Connection,
    sql: &str,
    parameters: [String; 1],
) -> Result<Vec<Family>, AppError> {
    let mut statement = connection.prepare(sql)?;
    let families = statement
        .query_map(parameters, map_family)?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(families)
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
}
