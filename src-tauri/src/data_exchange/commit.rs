use std::collections::{BTreeMap, BTreeSet};

use rusqlite::{Connection, TransactionBehavior};

use crate::customer::{
    create_with_connection as create_customer, ensure_active_with_connection,
    validate_create as validate_customer, CreateCustomerInput,
};
use crate::error::AppError;
use crate::insurance::{
    create_with_connection as create_policy, update_import_fields_with_connection,
    validate_create as validate_policy, CreateInsurancePolicyInput,
};

use super::commit_model::{
    ImportCommitOutcome, ImportCommitOutcomeKind, ImportCommitRequest, ImportCommitResult,
    ImportCustomerReference, ImportRowDecision, MappedContractPolicy,
};
use super::commit_validation::validate_commit_request;
use super::context::{load_context, normalize_key, ImportContextQuery, ImportDuplicateKey};
use super::persistence::upsert_source;

#[cfg(feature = "e2e")]
use super::commit_e2e::{e2e_import_failure_source_row, fail_e2e_import_once};

pub(crate) fn commit_import(
    connection: &mut Connection,
    request: ImportCommitRequest,
) -> Result<ImportCommitResult, AppError> {
    let request = validate_commit_request(request)?;
    #[cfg(feature = "e2e")]
    {
        let failure_row =
            e2e_import_failure_source_row(std::env::var_os("BODAM_E2E_IMPORT_FAIL_SOURCE_ROW"))?;
        commit_validated_import(connection, request, failure_row)
    }
    #[cfg(not(feature = "e2e"))]
    commit_validated_import(connection, request)
}

pub(super) fn commit_validated_import(
    connection: &mut Connection,
    request: ImportCommitRequest,
    #[cfg(feature = "e2e")] failure_row: Option<u32>,
) -> Result<ImportCommitResult, AppError> {
    let transaction = connection
        .transaction_with_behavior(TransactionBehavior::Immediate)
        .map_err(|_| AppError::Database)?;
    let context = load_context(
        &transaction,
        ImportContextQuery {
            keys: duplicate_keys(&request),
        },
    )?;
    if context.snapshot_token != request.snapshot_token {
        return Err(AppError::ImportConflict);
    }

    let mut candidate_ids = BTreeMap::new();
    let mut occupied_keys = BTreeSet::new();
    for candidate in context.duplicate_candidates {
        let key = (candidate.insurer, candidate.policy_number);
        occupied_keys.insert(key.clone());
        candidate_ids.insert(candidate.policy_id, key);
    }
    let new_customer_ids = create_new_customers(&transaction, &request)?;
    let summary = request.summary.clone();
    let mut seen_batch_keys = BTreeSet::new();
    let mut outcomes = Vec::with_capacity(request.rows.len());
    let mut created = 0_u32;
    let mut updated = 0_u32;
    let mut skipped = 0_u32;

    for row in request.rows {
        #[cfg(feature = "e2e")]
        fail_e2e_import_once(failure_row, row.source.source_row)?;
        let key = row_duplicate_key(
            &row.mapped.insurer,
            row.source.cells.policy_number.as_deref(),
        );
        let already_seen = key
            .as_ref()
            .is_some_and(|value| !seen_batch_keys.insert(value.clone()));
        let policy_write = validate_policy(policy_input(&row.mapped))?;
        match row.decision {
            ImportRowDecision::Skip => {
                skipped += 1;
                outcomes.push(outcome(
                    row.source.source_row,
                    ImportCommitOutcomeKind::Skipped,
                    None,
                ));
            }
            ImportRowDecision::Create { customer } => {
                if already_seen
                    || key
                        .as_ref()
                        .is_some_and(|value| occupied_keys.contains(value))
                {
                    return Err(AppError::ImportConflict);
                }
                let customer_id = resolve_customer(&transaction, &new_customer_ids, customer)?;
                let policy = create_policy(&transaction, &customer_id, policy_write)?;
                upsert_source(&transaction, &policy.id, &row.source.cells)?;
                if let Some(key) = key {
                    occupied_keys.insert(key);
                }
                created += 1;
                outcomes.push(outcome(
                    row.source.source_row,
                    ImportCommitOutcomeKind::Created,
                    Some(policy.id),
                ));
            }
            ImportRowDecision::SeparateCreate { customer } => {
                let customer_id = resolve_customer(&transaction, &new_customer_ids, customer)?;
                let policy = create_policy(&transaction, &customer_id, policy_write)?;
                upsert_source(&transaction, &policy.id, &row.source.cells)?;
                if let Some(key) = key {
                    occupied_keys.insert(key);
                }
                created += 1;
                outcomes.push(outcome(
                    row.source.source_row,
                    ImportCommitOutcomeKind::Created,
                    Some(policy.id),
                ));
            }
            ImportRowDecision::Update { target_policy_id } => {
                let Some(key) = key else {
                    return Err(AppError::ImportConflict);
                };
                if candidate_ids.get(&target_policy_id) != Some(&key) {
                    return Err(AppError::ImportConflict);
                }
                let policy = update_import_fields_with_connection(
                    &transaction,
                    &target_policy_id,
                    policy_write,
                )
                .map_err(as_import_conflict)?;
                upsert_source(&transaction, &policy.id, &row.source.cells)?;
                updated += 1;
                outcomes.push(outcome(
                    row.source.source_row,
                    ImportCommitOutcomeKind::Updated,
                    Some(policy.id),
                ));
            }
        }
    }
    transaction.commit().map_err(|_| AppError::Database)?;
    Ok(ImportCommitResult {
        created,
        updated,
        skipped,
        total_rows: summary.total_rows,
        invalid_rows: summary.invalid_rows,
        unselected_rows: summary.unselected_rows,
        outcomes,
    })
}

fn create_new_customers(
    connection: &Connection,
    request: &ImportCommitRequest,
) -> Result<BTreeMap<String, String>, AppError> {
    request
        .new_customers
        .iter()
        .map(|definition| {
            let input = CreateCustomerInput {
                name: definition.name.clone(),
                birth_date: None,
                gender: None,
                phone: None,
                address: None,
                memo: None,
                status: None,
                is_managed: true,
            };
            let customer = create_customer(connection, validate_customer(input)?)?;
            Ok((definition.client_key.clone(), customer.id))
        })
        .collect()
}

fn resolve_customer(
    connection: &Connection,
    new_customer_ids: &BTreeMap<String, String>,
    reference: ImportCustomerReference,
) -> Result<String, AppError> {
    match reference {
        ImportCustomerReference::Existing { customer_id } => {
            ensure_active_with_connection(connection, &customer_id).map_err(as_import_conflict)?;
            Ok(customer_id)
        }
        ImportCustomerReference::New { client_key } => new_customer_ids
            .get(&client_key)
            .cloned()
            .ok_or(AppError::ImportConflict),
    }
}

fn duplicate_keys(request: &ImportCommitRequest) -> Vec<ImportDuplicateKey> {
    request
        .rows
        .iter()
        .filter_map(|row| {
            row_duplicate_key(
                &row.mapped.insurer,
                row.source.cells.policy_number.as_deref(),
            )
        })
        .collect::<BTreeSet<_>>()
        .into_iter()
        .map(|(insurer, policy_number)| ImportDuplicateKey {
            insurer,
            policy_number,
        })
        .collect()
}

fn row_duplicate_key(insurer: &str, policy_number: Option<&str>) -> Option<(String, String)> {
    let policy_number = policy_number
        .map(normalize_key)
        .filter(|value| !value.is_empty())?;
    Some((normalize_key(insurer), policy_number))
}

fn policy_input(mapped: &MappedContractPolicy) -> CreateInsurancePolicyInput {
    CreateInsurancePolicyInput {
        insurer: mapped.insurer.clone(),
        product_name: mapped.product_name.clone(),
        joined_on: mapped.joined_on.clone(),
        coverage_term: None,
        payment_term: mapped.payment_term.clone(),
        monthly_premium_won: mapped.monthly_premium_won.clone(),
        disclosure_plan: None,
        matures_on: mapped.matures_on.clone(),
        renewable: false,
        status: mapped.status.clone(),
        is_included: true,
    }
}

fn outcome(
    source_row: u32,
    outcome: ImportCommitOutcomeKind,
    policy_id: Option<String>,
) -> ImportCommitOutcome {
    ImportCommitOutcome {
        source_row,
        outcome,
        policy_id,
    }
}

fn as_import_conflict(error: AppError) -> AppError {
    match error {
        AppError::CustomerNotFound | AppError::InsurancePolicyNotFound => AppError::ImportConflict,
        other => other,
    }
}
