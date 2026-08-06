use serde::{Deserialize, Deserializer, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InsurancePolicy {
    pub id: String,
    pub customer_id: String,
    pub insurer: String,
    pub product_name: String,
    pub joined_on: Option<String>,
    pub coverage_term: Option<String>,
    pub payment_term: Option<String>,
    pub monthly_premium_won: String,
    pub disclosure_plan: Option<String>,
    pub matures_on: Option<String>,
    pub renewable: bool,
    pub status: Option<String>,
    pub is_included: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateInsurancePolicyInput {
    pub insurer: String,
    pub product_name: String,
    #[serde(default)]
    pub joined_on: Option<String>,
    #[serde(default)]
    pub coverage_term: Option<String>,
    #[serde(default)]
    pub payment_term: Option<String>,
    pub monthly_premium_won: String,
    #[serde(default)]
    pub disclosure_plan: Option<String>,
    #[serde(default)]
    pub matures_on: Option<String>,
    #[serde(default)]
    pub renewable: bool,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default = "included_by_default")]
    pub is_included: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateInsurancePolicyInput {
    pub insurer: String,
    pub product_name: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub joined_on: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub coverage_term: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub payment_term: Option<String>,
    pub monthly_premium_won: String,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub disclosure_plan: Option<String>,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub matures_on: Option<String>,
    pub renewable: bool,
    #[serde(deserialize_with = "deserialize_required_nullable")]
    pub status: Option<String>,
    pub is_included: bool,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedInsurancePolicy {
    pub id: String,
}

#[derive(Debug, Clone)]
pub(crate) struct InsurancePolicyWrite {
    pub insurer: String,
    pub product_name: String,
    pub joined_on: Option<String>,
    pub coverage_term: Option<String>,
    pub payment_term: Option<String>,
    pub monthly_premium_won: i64,
    pub disclosure_plan: Option<String>,
    pub matures_on: Option<String>,
    pub renewable: bool,
    pub status: Option<String>,
    pub is_included: bool,
}

const fn included_by_default() -> bool {
    true
}

fn deserialize_required_nullable<'de, D>(deserializer: D) -> Result<Option<String>, D::Error>
where
    D: Deserializer<'de>,
{
    Option::<String>::deserialize(deserializer)
}
