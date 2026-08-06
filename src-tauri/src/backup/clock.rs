use chrono::{DateTime, Local, NaiveDate, Utc};

#[derive(Clone, Debug, Eq, PartialEq)]
pub(crate) struct ClockReading {
    pub utc: DateTime<Utc>,
    pub local_date: NaiveDate,
}

pub(crate) trait BackupClock: Send + Sync {
    fn now(&self) -> ClockReading;
}

pub(crate) struct SystemBackupClock;

impl BackupClock for SystemBackupClock {
    fn now(&self) -> ClockReading {
        let local = Local::now();
        ClockReading {
            utc: local.with_timezone(&Utc),
            local_date: local.date_naive(),
        }
    }
}
