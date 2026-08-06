use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Schedule {
    pub id: String,
    pub customer_id: Option<String>,
    pub title: String,
    pub scheduled_on: String,
    pub scheduled_time: Option<String>,
    pub memo: Option<String>,
    pub is_completed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateScheduleInput {
    pub title: String,
    pub scheduled_on: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub scheduled_time: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub memo: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub customer_id: Option<String>,
    pub is_completed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateScheduleInput {
    pub title: String,
    pub scheduled_on: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub scheduled_time: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub memo: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub customer_id: Option<String>,
    pub is_completed: bool,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedSchedule {
    pub id: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ScheduleWrite {
    pub title: String,
    pub scheduled_on: String,
    pub scheduled_time: Option<String>,
    pub memo: Option<String>,
    pub customer_id: Option<String>,
    pub is_completed: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ScheduleRange {
    pub start_on: String,
    pub end_before: String,
}

fn deserialize_required_nullable<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer)
}
