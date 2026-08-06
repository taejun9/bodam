use rusqlite::{params, OptionalExtension};

use crate::coverage::model::{CoverageCategory, DeletedCoverageCategory};
use crate::error::AppError;

use super::mapping::{map_category, now_utc};
use super::CoverageRepository;

const SELECT_ACTIVE: &str = r#"
SELECT id, name, created_at, updated_at
FROM coverage_categories
WHERE deleted_at IS NULL
ORDER BY id ASC
"#;

impl CoverageRepository {
    pub(crate) fn list_categories(&self) -> Result<Vec<CoverageCategory>, AppError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(SELECT_ACTIVE)?;
        let categories = statement
            .query_map([], map_category)?
            .collect::<Result<Vec<_>, _>>()
            .map_err(AppError::from)?;
        Ok(categories)
    }

    pub(crate) fn update_category(
        &self,
        id: &str,
        name: String,
    ) -> Result<CoverageCategory, AppError> {
        let connection = self.lock()?;
        let changed = connection.execute(
            "UPDATE coverage_categories
             SET name = ?2, updated_at = ?3
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, name, now_utc()],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageCategoryNotFound);
        }
        find_active_category(&connection, id)
    }

    pub(crate) fn soft_delete_category(
        &self,
        id: &str,
    ) -> Result<DeletedCoverageCategory, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            "UPDATE coverage_categories
             SET deleted_at = ?2, updated_at = ?2
             WHERE id = ?1 AND deleted_at IS NULL",
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::CoverageCategoryNotFound);
        }
        Ok(DeletedCoverageCategory { id: id.to_owned() })
    }
}

pub(super) fn ensure_active_category(
    connection: &rusqlite::Connection,
    id: &str,
) -> Result<(), AppError> {
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

fn find_active_category(
    connection: &rusqlite::Connection,
    id: &str,
) -> Result<CoverageCategory, AppError> {
    connection
        .query_row(
            "SELECT id, name, created_at, updated_at
             FROM coverage_categories
             WHERE id = ?1 AND deleted_at IS NULL",
            [id],
            map_category,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::CoverageCategoryNotFound,
            _ => AppError::Database,
        })
}
