use std::ffi::OsString;
use std::sync::atomic::Ordering;

use crate::error::AppError;

use super::commit::commit_validated_import;
use super::commit_e2e::{e2e_import_failure_source_row, E2E_IMPORT_FAILURE_USED};
use super::commit_model::{ImportCustomerReference, ImportRowDecision, NewImportCustomer};
use super::test_database::{counts, repository, seed_customer};
use super::test_support::{cells, context, request, row, CUSTOMER_A};

#[test]
fn source_row_four_failure_rolls_back_all_writes_and_only_fires_once() {
    E2E_IMPORT_FAILURE_USED.store(false, Ordering::SeqCst);
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 기존 고객");
    let snapshot = context(
        &repository,
        &[
            ("합성보험A", "POL-A"),
            ("합성보험B", "POL-B"),
            ("합성보험C", "POL-C"),
        ],
    );

    let error = commit_with_row_four_failure(&repository, &snapshot.snapshot_token).unwrap_err();
    assert_eq!(error, AppError::ImportConflict);
    assert_eq!(counts(&repository), (1, 0, 0));

    let retry = commit_with_row_four_failure(&repository, &snapshot.snapshot_token).unwrap();
    assert_eq!((retry.created, retry.updated, retry.skipped), (3, 0, 0));
    assert_eq!(counts(&repository), (2, 3, 3));
}

#[test]
fn failure_row_environment_value_is_strict_and_safe() {
    assert_eq!(e2e_import_failure_source_row(None).unwrap(), None);
    for valid in ["2", "4", "4294967295"] {
        assert_eq!(
            e2e_import_failure_source_row(Some(OsString::from(valid))).unwrap(),
            Some(valid.parse().unwrap())
        );
    }
    for invalid in ["", "0", "1", "04", "+4", " 4", "4 ", "4294967296", "４"] {
        assert_eq!(
            e2e_import_failure_source_row(Some(OsString::from(invalid))).unwrap_err(),
            AppError::ImportConflict
        );
    }

    let marker = "4-private-source-row";
    let error = e2e_import_failure_source_row(Some(OsString::from(marker))).unwrap_err();
    assert!(!serde_json::to_string(&error).unwrap().contains(marker));
}

fn commit_with_row_four_failure(
    repository: &super::repository::DataExchangeRepository,
    snapshot_token: &str,
) -> Result<super::commit_model::ImportCommitResult, AppError> {
    let new_reference = || ImportCustomerReference::New {
        client_key: "rollback-new".to_owned(),
    };
    let request = request(
        snapshot_token,
        vec![
            row(
                2,
                cells("첫째", "합성보험A", "합성상품A", "POL-A", "1000"),
                ImportRowDecision::Create {
                    customer: ImportCustomerReference::Existing {
                        customer_id: CUSTOMER_A.to_owned(),
                    },
                },
            ),
            row(
                3,
                cells("둘째", "합성보험B", "합성상품B", "POL-B", "2000"),
                ImportRowDecision::Create {
                    customer: new_reference(),
                },
            ),
            row(
                4,
                cells("셋째", "합성보험C", "합성상품C", "POL-C", "3000"),
                ImportRowDecision::Create {
                    customer: new_reference(),
                },
            ),
        ],
        vec![NewImportCustomer {
            client_key: "rollback-new".to_owned(),
            name: "rollback 합성 신규 고객".to_owned(),
        }],
    );
    let request = super::commit_validation::validate_commit_request(request)?;
    let mut connection = repository.lock()?;
    commit_validated_import(&mut connection, request, Some(4))
}
