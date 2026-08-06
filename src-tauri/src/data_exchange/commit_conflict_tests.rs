use crate::error::AppError;

use super::commit_model::{ImportCustomerReference, ImportRowDecision, NewImportCustomer};
use super::test_database::*;
use super::test_support::*;

fn create(customer_id: &str) -> ImportRowDecision {
    ImportRowDecision::Create {
        customer: ImportCustomerReference::Existing {
            customer_id: customer_id.to_owned(),
        },
    }
}

fn policy_id(result: &super::commit_model::ImportCommitResult) -> String {
    result.outcomes[0].policy_id.clone().unwrap()
}

#[test]
fn second_row_conflict_rolls_back_first_row_and_new_customer() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 기존 고객");
    let snapshot = context(&repository, &[("보험A", "POL-A"), ("보험B", "POL-B")]);
    let error = repository
        .commit(request(
            &snapshot.snapshot_token,
            vec![
                row(
                    2,
                    cells("첫째", "보험A", "상품A", "POL-A", "1000"),
                    ImportRowDecision::Create {
                        customer: ImportCustomerReference::New {
                            client_key: "rolled-back".to_owned(),
                        },
                    },
                ),
                row(
                    3,
                    cells("둘째", "보험B", "상품B", "POL-B", "2000"),
                    create(MISSING_CUSTOMER),
                ),
            ],
            vec![NewImportCustomer {
                client_key: "rolled-back".to_owned(),
                name: "롤백 신규 고객".to_owned(),
            }],
        ))
        .unwrap_err();
    assert_eq!(error, AppError::ImportConflict);
    assert_eq!(counts(&repository), (1, 0, 0));
}

#[test]
fn stale_snapshot_after_another_import_rejects_all_writes() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 고객");
    let stale = context(&repository, &[]);
    repository
        .commit(request(
            &stale.snapshot_token,
            vec![row(
                2,
                cells("선행", "보험B", "상품B", "POL-B", "2000"),
                create(CUSTOMER_A),
            )],
            vec![],
        ))
        .unwrap();
    let error = repository
        .commit(request(
            &stale.snapshot_token,
            vec![row(
                2,
                cells("후행", "보험A", "상품A", "POL-A", "1000"),
                create(CUSTOMER_A),
            )],
            vec![],
        ))
        .unwrap_err();
    assert_eq!(error, AppError::ImportConflict);
    assert_eq!(counts(&repository), (1, 1, 1));
}

#[test]
fn repeated_update_target_is_rejected_before_any_write() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 고객");
    let original = cells("원본", "중복보험", "원본상품", "POL-SAME", "1000");
    let empty = context(&repository, &[("중복보험", "POL-SAME")]);
    let created = repository
        .commit(request(
            &empty.snapshot_token,
            vec![row(2, original.clone(), create(CUSTOMER_A))],
            vec![],
        ))
        .unwrap();
    let target = policy_id(&created);
    let before_policy = policy_state(&repository, &target);
    let before_source = stored_source(&repository, &target);
    let duplicate = context(&repository, &[("중복보험", "POL-SAME")]);

    let error = repository
        .commit(request(
            &duplicate.snapshot_token,
            vec![
                row(
                    2,
                    cells("변경1", "중복보험", "변경상품1", "POL-SAME", "2000"),
                    ImportRowDecision::Update {
                        target_policy_id: target.clone(),
                    },
                ),
                row(
                    3,
                    cells("변경2", "중복보험", "변경상품2", "POL-SAME", "3000"),
                    ImportRowDecision::Update {
                        target_policy_id: target.clone(),
                    },
                ),
            ],
            vec![],
        ))
        .unwrap_err();

    assert!(matches!(error, AppError::Validation(_)));
    assert_eq!(policy_state(&repository, &target), before_policy);
    assert_eq!(stored_source(&repository, &target), before_source);
    assert_eq!(counts(&repository), (1, 1, 1));
}

#[test]
fn soft_deleted_customer_and_update_target_are_conflicts() {
    let customer_repository = repository();
    seed_customer(&customer_repository, CUSTOMER_A, "합성 고객");
    let snapshot = context(&customer_repository, &[]);
    soft_delete_customer(&customer_repository, CUSTOMER_A);
    let error = customer_repository
        .commit(request(
            &snapshot.snapshot_token,
            vec![row(
                2,
                cells("고객삭제", "보험A", "상품A", "POL-A", "1000"),
                create(CUSTOMER_A),
            )],
            vec![],
        ))
        .unwrap_err();
    assert_eq!(error, AppError::ImportConflict);
    assert_eq!(counts(&customer_repository), (1, 0, 0));

    let policy_repository = repository();
    seed_customer(&policy_repository, CUSTOMER_A, "합성 고객");
    let source = cells("계약삭제", "보험B", "상품B", "POL-B", "2000");
    let empty = context(&policy_repository, &[("보험B", "POL-B")]);
    let created = policy_repository
        .commit(request(
            &empty.snapshot_token,
            vec![row(2, source.clone(), create(CUSTOMER_A))],
            vec![],
        ))
        .unwrap();
    let target = policy_id(&created);
    let update_snapshot = context(&policy_repository, &[("보험B", "POL-B")]);
    soft_delete_policy(&policy_repository, &target);
    let error = policy_repository
        .commit(request(
            &update_snapshot.snapshot_token,
            vec![row(
                2,
                source,
                ImportRowDecision::Update {
                    target_policy_id: target,
                },
            )],
            vec![],
        ))
        .unwrap_err();
    assert_eq!(error, AppError::ImportConflict);
    assert_eq!(counts(&policy_repository), (1, 1, 1));
}
