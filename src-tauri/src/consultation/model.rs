use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Consultation {
    pub id: String,
    pub customer_id: String,
    pub consulted_at: String,
    pub content: Option<String>,
    pub next_contact_on: Option<String>,
    pub result: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateConsultationInput {
    pub consulted_at: String,
    #[serde(default)]
    pub content: Option<String>,
    #[serde(default)]
    pub next_contact_on: Option<String>,
    #[serde(default)]
    pub result: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateConsultationInput {
    pub consulted_at: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub content: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub next_contact_on: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub result: Option<String>,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedConsultation {
    pub id: String,
}

#[derive(Debug, Clone)]
pub(crate) struct ConsultationWrite {
    pub consulted_at: String,
    pub content: Option<String>,
    pub next_contact_on: Option<String>,
    pub result: Option<String>,
}

fn deserialize_required_nullable<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer)
}
