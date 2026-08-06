use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard};

use chrono::{SecondsFormat, Utc};
use rusqlite::{params, Connection, Row, TransactionBehavior};

use crate::database;
use crate::error::AppError;

use super::model::{safe_directory_basename, AppSettingsView, AppSettingsWrite, StoredAppSettings};
use super::validation::validate_values;

const SELECT_SETTINGS: &str = r#"
SELECT theme, recent_consultation_days, unconsulted_days,
       dashboard_item_limit, custom_backup_directory
FROM app_settings
WHERE id = 1
"#;

pub(crate) struct SettingsRepository {
    connection: Mutex<Connection>,
}

impl SettingsRepository {
    pub(crate) fn open(path: &Path) -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open(path)?),
        })
    }

    #[cfg(test)]
    pub(crate) fn new_in_memory() -> Result<Self, AppError> {
        Ok(Self {
            connection: Mutex::new(database::open_in_memory()?),
        })
    }

    pub(crate) fn load(&self) -> Result<StoredAppSettings, AppError> {
        let connection = self.lock()?;
        load_from(&connection)
    }

    pub(crate) fn update(&self, input: AppSettingsWrite) -> Result<StoredAppSettings, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = transaction.execute(
            "UPDATE app_settings SET theme = ?1, recent_consultation_days = ?2,
                    unconsulted_days = ?3, dashboard_item_limit = ?4, updated_at = ?5
             WHERE id = 1",
            params![
                input.theme,
                input.recent_consultation_days,
                input.unconsulted_days,
                input.dashboard_item_limit,
                now_utc(),
            ],
        )?;
        ensure_singleton(changed)?;
        let settings = load_from(&transaction)?;
        transaction.commit()?;
        Ok(settings)
    }

    pub(crate) fn custom_backup_directory(&self) -> Result<Option<PathBuf>, AppError> {
        Ok(self.load()?.custom_backup_directory)
    }

    pub(crate) fn set_custom_backup_directory(
        &self,
        directory: &Path,
    ) -> Result<AppSettingsView, AppError> {
        if safe_directory_basename(directory).is_none() {
            return Err(AppError::StateUnavailable);
        }
        let encoded = directory.to_str().ok_or(AppError::StateUnavailable)?;
        self.update_directory(Some(encoded))
    }

    pub(crate) fn clear_custom_backup_directory(&self) -> Result<AppSettingsView, AppError> {
        self.update_directory(None)
    }

    fn update_directory(&self, directory: Option<&str>) -> Result<AppSettingsView, AppError> {
        let mut connection = self.lock()?;
        let transaction = connection.transaction_with_behavior(TransactionBehavior::Immediate)?;
        let changed = transaction.execute(
            "UPDATE app_settings SET custom_backup_directory = ?1, updated_at = ?2 WHERE id = 1",
            params![directory, now_utc()],
        )?;
        ensure_singleton(changed)?;
        let settings = load_from(&transaction)?;
        transaction.commit()?;
        settings.to_view()
    }

    fn lock(&self) -> Result<MutexGuard<'_, Connection>, AppError> {
        self.connection
            .lock()
            .map_err(|_| AppError::StateUnavailable)
    }
}

fn load_from(connection: &Connection) -> Result<StoredAppSettings, AppError> {
    connection
        .query_row(SELECT_SETTINGS, [], map_settings)
        .map_err(|_| AppError::Database)
}

fn map_settings(row: &Row<'_>) -> rusqlite::Result<StoredAppSettings> {
    let theme = row.get::<_, String>(0)?;
    let recent = row.get::<_, i64>(1)?;
    let unconsulted = row.get::<_, i64>(2)?;
    let limit = row.get::<_, i64>(3)?;
    let validated = validate_values(theme, recent, unconsulted, limit).map_err(|error| {
        rusqlite::Error::FromSqlConversionFailure(0, rusqlite::types::Type::Text, Box::new(error))
    })?;
    let custom_backup_directory = row.get::<_, Option<String>>(4)?.map(PathBuf::from);
    if custom_backup_directory
        .as_deref()
        .is_some_and(|path| safe_directory_basename(path).is_none())
    {
        return Err(rusqlite::Error::FromSqlConversionFailure(
            4,
            rusqlite::types::Type::Text,
            Box::new(AppError::Database),
        ));
    }
    Ok(StoredAppSettings {
        theme: validated.theme,
        recent_consultation_days: validated.recent_consultation_days,
        unconsulted_days: validated.unconsulted_days,
        dashboard_item_limit: validated.dashboard_item_limit,
        custom_backup_directory,
    })
}

fn ensure_singleton(changed: usize) -> Result<(), AppError> {
    if changed != 1 {
        return Err(AppError::Database);
    }
    Ok(())
}

fn now_utc() -> String {
    Utc::now().to_rfc3339_opts(SecondsFormat::Millis, true)
}
