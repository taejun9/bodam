use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{Consultation, ConsultationWrite, DeletedConsultation};

const SELECT_ACTIVE_BY_CUSTOMER: &str = r#"
SELECT n.id, n.customer_id, n.consulted_at, n.content,
       n.next_contact_on, n.result, n.created_at, n.updated_at
FROM consultations n
JOIN customers c ON c.id = n.customer_id
WHERE n.customer_id = ?1
  AND n.deleted_at IS NULL
  AND c.deleted_at IS NULL
ORDER BY n.consulted_at DESC, n.id ASC
"#;

pub(crate) struct ConsultationRepository {
    connection: Mutex<Connection>,
}

impl ConsultationRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    pub(crate) fn list(&self, customer_id: &str) -> Result<Vec<Consultation>, AppError> {
        let connection = self.lock()?;
        ensure_active_customer(&connection, customer_id)?;
        let mut statement = connection.prepare(SELECT_ACTIVE_BY_CUSTOMER)?;
        let consultations = statement
            .query_map([customer_id], map_consultation)?
            .collect::<Result<Vec<_>, _>>()?;
        Ok(consultations)
    }

    pub(crate) fn create(
        &self,
        customer_id: &str,
        input: ConsultationWrite,
    ) -> Result<Consultation, AppError> {
        let connection = self.lock()?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        let changed = connection.execute(
            r#"INSERT INTO consultations (
                   id, customer_id, consulted_at, content,
                   next_contact_on, result, created_at, updated_at
               )
               SELECT ?2, id, ?3, ?4, ?5, ?6, ?7, ?7
               FROM customers
               WHERE id = ?1 AND deleted_at IS NULL"#,
            params![
                customer_id,
                id,
                input.consulted_at,
                input.content,
                input.next_contact_on,
                input.result,
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
        input: ConsultationWrite,
    ) -> Result<Consultation, AppError> {
        let connection = self.lock()?;
        let changed = connection.execute(
            r#"UPDATE consultations SET
                   consulted_at = ?2, content = ?3, next_contact_on = ?4,
                   result = ?5, updated_at = ?6
               WHERE id = ?1 AND deleted_at IS NULL
                 AND EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = consultations.customer_id
                     AND c.deleted_at IS NULL
                 )"#,
            params![
                id,
                input.consulted_at,
                input.content,
                input.next_contact_on,
                input.result,
                now_utc(),
            ],
        )?;
        if changed == 0 {
            return Err(AppError::ConsultationNotFound);
        }
        find_active(&connection, id)
    }

    pub(crate) fn soft_delete(&self, id: &str) -> Result<DeletedConsultation, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            r#"UPDATE consultations
               SET deleted_at = ?2, updated_at = ?2
               WHERE id = ?1 AND deleted_at IS NULL
                 AND EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = consultations.customer_id
                     AND c.deleted_at IS NULL
                 )"#,
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::ConsultationNotFound);
        }
        Ok(DeletedConsultation { id: id.to_owned() })
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

fn find_active(connection: &Connection, id: &str) -> Result<Consultation, AppError> {
    connection
        .query_row(
            r#"SELECT n.id, n.customer_id, n.consulted_at, n.content,
                      n.next_contact_on, n.result, n.created_at, n.updated_at
               FROM consultations n
               JOIN customers c ON c.id = n.customer_id
               WHERE n.id = ?1 AND n.deleted_at IS NULL AND c.deleted_at IS NULL"#,
            [id],
            map_consultation,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::ConsultationNotFound,
            _ => AppError::Database,
        })
}

fn map_consultation(row: &Row<'_>) -> rusqlite::Result<Consultation> {
    Ok(Consultation {
        id: row.get(0)?,
        customer_id: row.get(1)?,
        consulted_at: read_utc_timestamp(row, 2)?,
        content: row.get(3)?,
        next_contact_on: row.get(4)?,
        result: row.get(5)?,
        created_at: read_utc_timestamp(row, 6)?,
        updated_at: read_utc_timestamp(row, 7)?,
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
