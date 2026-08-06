use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub birth_date: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub memo: Option<String>,
    pub status: Option<String>,
    pub is_managed: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateCustomerInput {
    pub name: String,
    #[serde(default)]
    pub birth_date: Option<String>,
    #[serde(default)]
    pub gender: Option<String>,
    #[serde(default)]
    pub phone: Option<String>,
    #[serde(default)]
    pub address: Option<String>,
    #[serde(default)]
    pub memo: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "managed_by_default")]
    pub is_managed: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateCustomerInput {
    pub name: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub birth_date: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub gender: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub phone: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub address: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub memo: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub status: Option<String>,
    pub is_managed: bool,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedCustomer {
    pub id: String,
}

#[derive(Debug, Clone)]
pub(crate) struct CustomerWrite {
    pub name: String,
    pub birth_date: Option<String>,
    pub gender: Option<String>,
    pub phone: Option<String>,
    pub address: Option<String>,
    pub memo: Option<String>,
    pub status: Option<String>,
    pub is_managed: bool,
}

const fn managed_by_default() -> bool {
    true
}

fn deserialize_required_nullable<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer)
}
