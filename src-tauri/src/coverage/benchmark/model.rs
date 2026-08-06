use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverageBenchmark {
    pub id: String,
    pub category_id: String,
    pub gender: String,
    pub min_age_years: i64,
    pub max_age_years: i64,
    pub adequate_min_won: String,
    pub excessive_min_won: String,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct CreateCoverageBenchmarkInput {
    pub category_id: String,
    pub gender: String,
    pub min_age_years: i64,
    pub max_age_years: i64,
    pub adequate_min_won: String,
    pub excessive_min_won: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub struct UpdateCoverageBenchmarkInput {
    pub category_id: String,
    pub gender: String,
    pub min_age_years: i64,
    pub max_age_years: i64,
    pub adequate_min_won: String,
    pub excessive_min_won: String,
}

#[derive(Debug, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedCoverageBenchmark {
    pub id: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct CoverageBenchmarkWrite {
    pub category_id: String,
    pub gender: String,
    pub min_age_years: i64,
    pub max_age_years: i64,
    pub adequate_min_won: i64,
    pub excessive_min_won: i64,
}
