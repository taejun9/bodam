use std::collections::{BTreeMap, BTreeSet};
use std::fmt::Write as _;

use rusqlite::Connection;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use unicode_normalization::UnicodeNormalization;

use crate::customer::{list_import_customer_bases, ImportCustomerBase};
use crate::error::AppError;
use crate::insurance::{list_import_policy_bases, ImportPolicyBase};
use crate::text::trim_ecmascript_whitespace;

use super::persistence::{list_source_keys, ImportSourceKey};

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase", deny_unknown_fields)]
pub(crate) struct ImportDuplicateKey {
    pub insurer: String,
    pub policy_number: String,
}

#[derive(Debug, Deserialize)]
#[serde(deny_unknown_fields)]
pub(crate) struct ImportContextQuery {
    pub keys: Vec<ImportDuplicateKey>,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportCustomerOption {
    pub id: String,
    pub name: String,
}

#[derive(Clone, Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportDuplicateCandidate {
    pub insurer: String,
    pub policy_number: String,
    pub policy_id: String,
    pub customer_id: String,
    pub product_name: String,
}

#[derive(Debug, Eq, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub(crate) struct ImportContextSnapshot {
    pub snapshot_token: String,
    pub customers: Vec<ImportCustomerOption>,
    pub duplicate_candidates: Vec<ImportDuplicateCandidate>,
}

pub(crate) fn load_context(
    connection: &Connection,
    query: ImportContextQuery,
) -> Result<ImportContextSnapshot, AppError> {
    let keys = validate_keys(query.keys)?;
    let customers = list_import_customer_bases(connection)?;
    let policies = list_import_policy_bases(connection)?;
    let sources = list_source_keys(connection)?;
    build_context(keys, customers, policies, sources)
}

fn validate_keys(keys: Vec<ImportDuplicateKey>) -> Result<BTreeSet<(String, String)>, AppError> {
    if keys.len() > 5_000 {
        return Err(validation("keys", "중복 확인 행이 허용 범위를 넘었습니다."));
    }
    let mut normalized = BTreeSet::new();
    for key in keys {
        let insurer = normalize_key(&key.insurer);
        let policy_number = normalize_key(&key.policy_number);
        if insurer.is_empty()
            || insurer.chars().count() > 200
            || policy_number.is_empty()
            || policy_number.chars().count() > 4_000
            || !normalized.insert((insurer, policy_number))
        {
            return Err(validation("keys", "중복 확인 기준을 확인해 주세요."));
        }
    }
    Ok(normalized)
}

fn build_context(
    keys: BTreeSet<(String, String)>,
    customers: Vec<ImportCustomerBase>,
    policies: Vec<ImportPolicyBase>,
    sources: Vec<ImportSourceKey>,
) -> Result<ImportContextSnapshot, AppError> {
    let customer_versions = customers
        .iter()
        .map(|customer| (customer.id.as_str(), customer.updated_at.as_str()))
        .collect::<BTreeMap<_, _>>();
    let source_by_policy = sources
        .into_iter()
        .map(|source| (source.policy_id.clone(), source))
        .collect::<BTreeMap<_, _>>();
    let mut version_rows = BTreeMap::new();
    let mut all_candidates = Vec::new();

    for policy in policies {
        let Some(source) = source_by_policy.get(&policy.id) else {
            continue;
        };
        let insurer = normalize_key(&policy.insurer);
        let policy_number = source
            .policy_number
            .as_deref()
            .map(normalize_key)
            .filter(|value| !value.is_empty());
        let Some(policy_number) = policy_number else {
            continue;
        };
        let customer_version = customer_versions
            .get(policy.customer_id.as_str())
            .copied()
            .ok_or(AppError::Database)?;
        version_rows.insert(
            policy.id.clone(),
            (
                policy.updated_at,
                source.updated_at.clone(),
                customer_version.to_owned(),
            ),
        );
        all_candidates.push(ImportDuplicateCandidate {
            insurer,
            policy_number,
            policy_id: policy.id,
            customer_id: policy.customer_id,
            product_name: policy.product_name,
        });
    }
    all_candidates.sort_by(|left, right| {
        (&left.insurer, &left.policy_number, &left.policy_id).cmp(&(
            &right.insurer,
            &right.policy_number,
            &right.policy_id,
        ))
    });
    let snapshot_token = snapshot_token(&all_candidates, &version_rows);
    let duplicate_candidates = all_candidates
        .into_iter()
        .filter(|candidate| {
            keys.contains(&(candidate.insurer.clone(), candidate.policy_number.clone()))
        })
        .collect();
    let customers = customers
        .into_iter()
        .map(|customer| ImportCustomerOption {
            id: customer.id,
            name: customer.name,
        })
        .collect();
    Ok(ImportContextSnapshot {
        snapshot_token,
        customers,
        duplicate_candidates,
    })
}

fn snapshot_token(
    candidates: &[ImportDuplicateCandidate],
    versions: &BTreeMap<String, (String, String, String)>,
) -> String {
    let mut digest = Sha256::new();
    for candidate in candidates {
        let version = versions
            .get(&candidate.policy_id)
            .expect("candidate version must be present");
        hash_field(&mut digest, &candidate.policy_id);
        hash_field(&mut digest, &candidate.customer_id);
        hash_field(&mut digest, &candidate.insurer);
        hash_field(&mut digest, &candidate.policy_number);
        hash_field(&mut digest, &candidate.product_name);
        hash_field(&mut digest, &version.0);
        hash_field(&mut digest, &version.1);
        hash_field(&mut digest, &version.2);
    }
    let bytes = digest.finalize();
    let mut encoded = String::with_capacity(bytes.len() * 2);
    for byte in bytes {
        let _ = write!(encoded, "{byte:02x}");
    }
    encoded
}

fn hash_field(digest: &mut Sha256, value: &str) {
    digest.update(value.len().to_be_bytes());
    digest.update(value.as_bytes());
}

pub(crate) fn normalize_key(value: &str) -> String {
    trim_ecmascript_whitespace(value).nfc().collect()
}

fn validation(field: &str, message: &str) -> AppError {
    AppError::Validation(BTreeMap::from([(field.to_owned(), message.to_owned())]))
}
