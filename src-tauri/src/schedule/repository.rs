use std::cmp::Ordering;
use std::path::Path;
use std::sync::{Mutex, MutexGuard};

#[cfg(test)]
use std::sync::Arc;

use chrono::{DateTime, NaiveDateTime, SecondsFormat, Utc};
use rusqlite::types::Type;
use rusqlite::{params, Connection, Row, TransactionBehavior};
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{DeletedSchedule, Schedule, ScheduleRange, ScheduleWrite};

const SELECT_ACTIVE_IN_RANGE: &str = r#"
SELECT s.id, s.customer_id, s.title, s.scheduled_on, s.scheduled_time,
       s.memo, s.is_completed, s.created_at, s.updated_at
FROM schedules s
LEFT JOIN customers c ON c.id = s.customer_id
WHERE s.scheduled_on >= ?1 AND s.scheduled_on < ?2
  AND s.deleted_at IS NULL
  AND (s.customer_id IS NULL OR (c.id IS NOT NULL AND c.deleted_at IS NULL))
ORDER BY s.scheduled_on ASC,
         CASE WHEN s.scheduled_time IS NULL THEN 0 ELSE 1 END ASC,
         s.scheduled_time ASC, s.title ASC, s.id ASC
"#;

pub(crate) struct ScheduleRepository {
    connection: Mutex<Connection>,
    #[cfg(test)]
    mutation_hook: Mutex<Option<Arc<dyn Fn() + Send + Sync>>>,
}

impl ScheduleRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
            #[cfg(test)]
            mutation_hook: Mutex::new(None),
        })
    }

    pub(crate) fn list(&self, range: &ScheduleRange) -> Result<Vec<Schedule>, AppError> {
        let connection = self.lock()?;
        let mut statement = connection.prepare(SELECT_ACTIVE_IN_RANGE)?;
        let mut schedules = statement
            .query_map([&range.start_on, &range.end_before], map_schedule)?
            .collect::<Result<Vec<_>, _>>()?;
        schedules.sort_by(compare_schedules);
        Ok(schedules)
    }

    pub(crate) fn create(&self, input: ScheduleWrite) -> Result<Schedule, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let id = Uuid::new_v4().to_string();
        let now = now_utc();
        let changed = transaction.execute(
            r#"INSERT INTO schedules (
                   id, customer_id, title, scheduled_on, scheduled_time,
                   memo, is_completed, created_at, updated_at
               )
               SELECT ?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?8
               WHERE ?2 IS NULL OR EXISTS (
                   SELECT 1 FROM customers
                   WHERE id = ?2 AND deleted_at IS NULL
               )"#,
            params![
                id,
                input.customer_id,
                input.title,
                input.scheduled_on,
                input.scheduled_time,
                input.memo,
                input.is_completed,
                now,
            ],
        )?;
        if changed == 0 {
            return Err(AppError::CustomerNotFound);
        }
        #[cfg(test)]
        self.run_mutation_hook()?;
        let schedule = find_active(&transaction, &id)?;
        transaction.commit()?;
        Ok(schedule)
    }

    pub(crate) fn update(&self, id: &str, input: ScheduleWrite) -> Result<Schedule, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        ensure_active_customer_if_linked(&transaction, input.customer_id.as_deref())?;
        let changed = transaction.execute(
            r#"UPDATE schedules SET
                   customer_id = ?2, title = ?3, scheduled_on = ?4,
                   scheduled_time = ?5, memo = ?6, is_completed = ?7,
                   updated_at = ?8
               WHERE id = ?1 AND deleted_at IS NULL
                 AND (customer_id IS NULL OR EXISTS (
                   SELECT 1 FROM customers current_customer
                   WHERE current_customer.id = schedules.customer_id
                     AND current_customer.deleted_at IS NULL
                 ))
                 AND (?2 IS NULL OR EXISTS (
                   SELECT 1 FROM customers next_customer
                   WHERE next_customer.id = ?2
                     AND next_customer.deleted_at IS NULL
                 ))"#,
            params![
                id,
                input.customer_id,
                input.title,
                input.scheduled_on,
                input.scheduled_time,
                input.memo,
                input.is_completed,
                now_utc(),
            ],
        )?;
        if changed == 0 {
            return Err(AppError::ScheduleNotFound);
        }
        #[cfg(test)]
        self.run_mutation_hook()?;
        let schedule = find_active(&transaction, id)?;
        transaction.commit()?;
        Ok(schedule)
    }

    pub(crate) fn set_completed(&self, id: &str, is_completed: bool) -> Result<Schedule, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = transaction.execute(
            r#"UPDATE schedules SET is_completed = ?2, updated_at = ?3
               WHERE id = ?1 AND deleted_at IS NULL
                 AND (customer_id IS NULL OR EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = schedules.customer_id AND c.deleted_at IS NULL
                 ))"#,
            params![id, is_completed, now_utc()],
        )?;
        if changed == 0 {
            return Err(AppError::ScheduleNotFound);
        }
        #[cfg(test)]
        self.run_mutation_hook()?;
        let schedule = find_active(&transaction, id)?;
        transaction.commit()?;
        Ok(schedule)
    }

    pub(crate) fn soft_delete(&self, id: &str) -> Result<DeletedSchedule, AppError> {
        let connection = self.lock()?;
        let now = now_utc();
        let changed = connection.execute(
            r#"UPDATE schedules SET deleted_at = ?2, updated_at = ?2
               WHERE id = ?1 AND deleted_at IS NULL
                 AND (customer_id IS NULL OR EXISTS (
                   SELECT 1 FROM customers c
                   WHERE c.id = schedules.customer_id AND c.deleted_at IS NULL
                 ))"#,
            params![id, now],
        )?;
        if changed == 0 {
            return Err(AppError::ScheduleNotFound);
        }
        Ok(DeletedSchedule { id: id.to_owned() })
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }

    #[cfg(test)]
    pub(crate) fn set_mutation_hook(&self, hook: Arc<dyn Fn() + Send + Sync>) {
        *self
            .mutation_hook
            .lock()
            .expect("Schedule mutation hook lock") = Some(hook);
    }

    #[cfg(test)]
    fn run_mutation_hook(&self) -> Result<(), AppError> {
        let hook = self
            .mutation_hook
            .lock()
            .map_err(|_| AppError::StateUnavailable)?
            .clone();
        if let Some(hook) = hook {
            hook();
        }
        Ok(())
    }
}

fn ensure_active_customer_if_linked(
    connection: &Connection,
    customer_id: Option<&str>,
) -> Result<(), AppError> {
    let Some(customer_id) = customer_id else {
        return Ok(());
    };
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

fn find_active(connection: &Connection, id: &str) -> Result<Schedule, AppError> {
    connection
        .query_row(
            r#"SELECT s.id, s.customer_id, s.title, s.scheduled_on,
                      s.scheduled_time, s.memo, s.is_completed,
                      s.created_at, s.updated_at
               FROM schedules s
               LEFT JOIN customers c ON c.id = s.customer_id
               WHERE s.id = ?1 AND s.deleted_at IS NULL
                 AND (s.customer_id IS NULL OR
                      (c.id IS NOT NULL AND c.deleted_at IS NULL))"#,
            [id],
            map_schedule,
        )
        .map_err(|error| match error {
            rusqlite::Error::QueryReturnedNoRows => AppError::ScheduleNotFound,
            _ => AppError::Database,
        })
}

fn map_schedule(row: &Row<'_>) -> rusqlite::Result<Schedule> {
    Ok(Schedule {
        id: row.get(0)?,
        customer_id: row.get(1)?,
        title: row.get(2)?,
        scheduled_on: row.get(3)?,
        scheduled_time: row.get(4)?,
        memo: row.get(5)?,
        is_completed: row.get(6)?,
        created_at: read_utc_timestamp(row, 7)?,
        updated_at: read_utc_timestamp(row, 8)?,
    })
}

fn compare_schedules(left: &Schedule, right: &Schedule) -> Ordering {
    left.scheduled_on
        .cmp(&right.scheduled_on)
        .then_with(|| left.scheduled_time.cmp(&right.scheduled_time))
        .then_with(|| compare_code_units(&left.title, &right.title))
        .then_with(|| left.id.cmp(&right.id))
}

fn compare_code_units(left: &str, right: &str) -> Ordering {
    left.encode_utf16().cmp(right.encode_utf16())
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
