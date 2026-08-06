use std::path::Path;
use std::sync::{Mutex, MutexGuard};

use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, Row};
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{Customer, CustomerWrite, DeletedCustomer};

const SELECT_ACTIVE: &str = r#"
SELECT id, name, birth_date, gender, phone, address, memo, status,
       is_managed, created_at, updated_at
FROM customers
WHERE deleted_at IS NULL
ORDER BY name COLLATE NOCASE ASC, id ASC
"#;

const SEARCH_ACTIVE: &str = r#"
SELECT id, name, birth_date, gender, phone, address, memo, status,
       is_managed, created_at, updated_at
FROM customers
WHERE deleted_at IS NULL
  AND (
    name COLLATE NOCASE LIKE ?1 ESCAPE '\'
    OR COALESCE(phone, '') COLLATE NOCASE LIKE ?1 ESCAPE '\'
    OR COALESCE(status, '') COLLATE NOCASE LIKE ?1 ESCAPE '\'
  )
ORDER BY name COLLATE NOCASE ASC, id ASC
"#;

pub(crate) struct CustomerRepository {
    connection: Mutex<Connection>,
}

impl CustomerRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    #[cfg(test)]
    pub(crate) fn in_memory() -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open_in_memory()?),
        })
    }

    pub(crate) fn list(&self, search: Option<String>) -> Result<Vec<Customer>, AppError> {
        let connection = self.lock()?;
        let normalized = search
            .map(|value| value.trim().to_owned())
            .filter(|value| !value.is_empty());

        if let Some(value) = normalized {
            let pattern = format!("%{}%", escape_like(&value));
            let mut statement = connection.prepare(SEARCH_ACTIVE)?;
            let customers = statement
                .query_map([pattern], map_customer)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(AppError::from)?;
            Ok(customers)
        } else {
            let mut statement = connection.prepare(SELECT_ACTIVE)?;
            let customers = statement
                .query_map([], map_customer)?
                .collect::<Result<Vec<_>, _>>()
                .map_err(AppError::from)?;
            Ok(customers)
        }
    }

    pub(crate) fn create(&self, input: CustomerWrite) -> Result<Customer, AppError> {
        let connection = self.lock()?;
        create_with_connection(&connection, input)
    }

    pub(crate) fn update(&self, id: &str, input: CustomerWrite) -> Result<Customer, AppError> {
        let connection = self.lock()?;
        let changed = connection.execute(
            r#"UPDATE customers SET
                name = ?2, birth_date = ?3, gender = ?4, phone = ?5,
                address = ?6, memo = ?7, status = ?8, is_managed = ?9,
                updated_at = ?10
            WHERE id = ?1 AND deleted_at IS NULL"#,
            params![
                id,
                input.name,
                input.birth_date,
                input.gender,
                input.phone,
                input.address,
                input.memo,
                input.status,
                input.is_managed,
                now_utc(),
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CustomerNotFound);
        }
        find_active(&connection, id)
    }

    pub(crate) fn soft_delete(&self, id: &str) -> Result<DeletedCustomer, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            "UPDATE customers SET deleted_at = ?2, updated_at = ?2 WHERE id = ?1 AND deleted_at IS NULL",
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::CustomerNotFound);
        }
        Ok(DeletedCustomer { id: id.to_owned() })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }
}

pub(crate) fn create_with_connection(
    connection: &Connection,
    input: CustomerWrite,
) -> Result<Customer, AppError> {
    let id = Uuid::new_v4().to_string();
    let now = now_utc();
    connection.execute(
        r#"INSERT INTO customers (
            id, name, birth_date, gender, phone, address, memo, status,
            is_managed, created_at, updated_at
        ) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?10)"#,
        params![
            id,
            input.name,
            input.birth_date,
            input.gender,
            input.phone,
            input.address,
            input.memo,
            input.status,
            input.is_managed,
            now,
        ],
    )?;
    find_active(connection, &id)
}

pub(crate) fn ensure_active_with_connection(
    connection: &Connection,
    id: &str,
) -> Result<(), AppError> {
    let exists = connection.query_row(
        "SELECT EXISTS(SELECT 1 FROM customers WHERE id = ?1 AND deleted_at IS NULL)",
        [id],
        |row| row.get::<_, bool>(0),
    )?;
    if !exists {
        return Err(AppError::CustomerNotFound);
    }
    Ok(())
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ImportCustomerBase {
    pub id: String,
    pub name: String,
    pub updated_at: String,
}

pub(crate) fn list_import_customer_bases(
    connection: &Connection,
) -> Result<Vec<ImportCustomerBase>, AppError> {
    let mut statement = connection.prepare(
        "SELECT id, name, updated_at FROM customers
         WHERE deleted_at IS NULL ORDER BY name ASC, id ASC",
    )?;
    let customers = statement
        .query_map([], |row| {
            Ok(ImportCustomerBase {
                id: row.get(0)?,
                name: row.get(1)?,
                updated_at: row.get(2)?,
            })
        })?
        .collect::<Result<Vec<_>, _>>()?;
    Ok(customers)
}

fn find_active(connection: &Connection, id: &str) -> Result<Customer, AppError> {
    connection
        .query_row(
            r#"SELECT id, name, birth_date, gender, phone, address, memo, status,
                      is_managed, created_at, updated_at
               FROM customers WHERE id = ?1 AND deleted_at IS NULL"#,
            [id],
            map_customer,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::CustomerNotFound,
            _ => AppError::Database,
        })
}

fn map_customer(row: &Row<'_>) -> rusqlite::Result<Customer> {
    Ok(Customer {
        id: row.get(0)?,
        name: row.get(1)?,
        birth_date: row.get(2)?,
        gender: row.get(3)?,
        phone: row.get(4)?,
        address: row.get(5)?,
        memo: row.get(6)?,
        status: row.get(7)?,
        is_managed: row.get(8)?,
        created_at: read_utc_timestamp(row, 9)?,
        updated_at: read_utc_timestamp(row, 10)?,
    })
}

fn escape_like(value: &str) -> String {
    value
        .replace('\\', "\\\\")
        .replace('%', "\\%")
        .replace('_', "\\_")
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
