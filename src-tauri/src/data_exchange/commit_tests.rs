use super::commit_model::{
    ImportCommitOutcomeKind, ImportCustomerReference, ImportRowDecision, NewImportCustomer,
};
use super::test_database::*;
use super::test_support::*;

fn existing(customer_id: &str) -> ImportCustomerReference {
    ImportCustomerReference::Existing {
        customer_id: customer_id.to_owned(),
    }
}

fn create(customer_id: &str) -> ImportRowDecision {
    ImportRowDecision::Create {
        customer: existing(customer_id),
    }
}

fn policy_id(result: &super::commit_model::ImportCommitResult, index: usize) -> String {
    result.outcomes[index].policy_id.clone().unwrap()
}

#[test]
fn creates_existing_and_shared_new_customer_with_all_source_cells() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 기존 고객");
    let first = cells("A", "합성보험A", "합성상품A", "POL-A", "0012345");
    let second = cells("B", "합성보험B", "합성상품B", "POL-B", "0023456");
    let third = cells("C", "합성보험C", "합성상품C", "POL-C", "0034567");
    let snapshot = context(
        &repository,
        &[
            ("합성보험A", "POL-A"),
            ("합성보험B", "POL-B"),
            ("합성보험C", "POL-C"),
        ],
    );
    let result = repository
        .commit(request(
            &snapshot.snapshot_token,
            vec![
                row(2, first.clone(), create(CUSTOMER_A)),
                row(
                    3,
                    second.clone(),
                    ImportRowDecision::Create {
                        customer: ImportCustomerReference::New {
                            client_key: "shared-new".to_owned(),
                        },
                    },
                ),
                row(
                    4,
                    third.clone(),
                    ImportRowDecision::Create {
                        customer: ImportCustomerReference::New {
                            client_key: "shared-new".to_owned(),
                        },
                    },
                ),
            ],
            vec![NewImportCustomer {
                client_key: "shared-new".to_owned(),
                name: "합성 신규 고객".to_owned(),
            }],
        ))
        .unwrap();

    assert_eq!((result.created, result.updated, result.skipped), (3, 0, 0));
    assert!(result
        .outcomes
        .iter()
        .all(|value| value.outcome == ImportCommitOutcomeKind::Created));
    assert_eq!(counts(&repository), (2, 3, 3));
    let new_customer = customer_id_named(&repository, "합성 신규 고객");
    let ids = [
        policy_id(&result, 0),
        policy_id(&result, 1),
        policy_id(&result, 2),
    ];
    assert_eq!(policy_state(&repository, &ids[0]).customer_id, CUSTOMER_A);
    assert_eq!(policy_state(&repository, &ids[1]).customer_id, new_customer);
    assert_eq!(policy_state(&repository, &ids[2]).customer_id, new_customer);
    assert_eq!(stored_source(&repository, &ids[0]), source_values(&first));
    assert_eq!(stored_source(&repository, &ids[1]), source_values(&second));
    assert_eq!(stored_source(&repository, &ids[2]), source_values(&third));
    let state = policy_state(&repository, &ids[0]);
    assert_eq!(state.monthly_premium_won, 12_345);
    assert_eq!(state.joined_on.as_deref(), Some("2026-01-02"));
    assert_eq!(state.payment_term.as_deref(), Some("20년"));
}

#[test]
fn new_customer_preserves_ecmascript_next_line_whitespace() {
    let repository = repository();
    let source = cells("NEL", "합성보험", "합성상품", "POL-NEL", "0001000");
    let snapshot = context(&repository, &[("합성보험", "POL-NEL")]);
    let name = "\u{0085}합성 신규 고객\u{0085}";

    repository
        .commit(request(
            &snapshot.snapshot_token,
            vec![row(
                2,
                source,
                ImportRowDecision::Create {
                    customer: ImportCustomerReference::New {
                        client_key: "nel-customer".to_owned(),
                    },
                },
            )],
            vec![NewImportCustomer {
                client_key: "nel-customer".to_owned(),
                name: name.to_owned(),
            }],
        ))
        .unwrap();

    assert!(!customer_id_named(&repository, name).is_empty());
}

#[test]
fn skip_and_explicit_update_preserve_customer_manual_fields_and_coverage() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 기존 고객");
    let original = cells("기존", "합성보험", "합성상품", "POL-DUP", "0001000");
    let snapshot = context(&repository, &[("합성보험", "POL-DUP")]);
    let created = repository
        .commit(request(
            &snapshot.snapshot_token,
            vec![row(2, original.clone(), create(CUSTOMER_A))],
            vec![],
        ))
        .unwrap();
    let target = policy_id(&created, 0);
    set_manual_fields_and_coverage(&repository, &target);

    let before_skip = policy_state(&repository, &target);
    let skip_snapshot = context(
        &repository,
        &[("합성보험", "POL-DUP"), ("다른보험", "POL-OTHER")],
    );
    let unrelated = cells("다른", "다른보험", "다른상품", "POL-OTHER", "0002000");
    let skipped = repository
        .commit(request(
            &skip_snapshot.snapshot_token,
            vec![
                row(2, original.clone(), ImportRowDecision::Skip),
                row(3, unrelated, create(CUSTOMER_A)),
            ],
            vec![],
        ))
        .unwrap();
    assert_eq!(
        (skipped.created, skipped.updated, skipped.skipped),
        (1, 0, 1)
    );
    assert_eq!(policy_state(&repository, &target), before_skip);
    assert_eq!(
        stored_source(&repository, &target),
        source_values(&original)
    );

    let changed = cells("변경", "합성보험", "변경상품", "POL-DUP", "0009876");
    let update_snapshot = context(&repository, &[("합성보험", "POL-DUP")]);
    let updated = repository
        .commit(request(
            &update_snapshot.snapshot_token,
            vec![row(
                2,
                changed.clone(),
                ImportRowDecision::Update {
                    target_policy_id: target.clone(),
                },
            )],
            vec![],
        ))
        .unwrap();
    assert_eq!(
        (updated.created, updated.updated, updated.skipped),
        (0, 1, 0)
    );
    let state = policy_state(&repository, &target);
    assert_eq!(state.customer_id, CUSTOMER_A);
    assert_eq!(state.product_name, "변경상품");
    assert_eq!(state.monthly_premium_won, 9_876);
    assert_eq!(state.coverage_term.as_deref(), Some("수동보장"));
    assert_eq!(state.disclosure_plan.as_deref(), Some("수동고지"));
    assert!(state.renewable);
    assert!(!state.is_included);
    assert!(coverage_intact(&repository, &target));
    assert_eq!(stored_source(&repository, &target), source_values(&changed));
}

#[test]
fn separate_create_allows_an_existing_duplicate_key() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 고객 A");
    seed_customer(&repository, CUSTOMER_B, "합성 고객 B");
    let first = cells("첫째", "공통보험", "상품A", "POL-SAME", "1000");
    let empty = context(&repository, &[("공통보험", "POL-SAME")]);
    repository
        .commit(request(
            &empty.snapshot_token,
            vec![row(2, first, create(CUSTOMER_A))],
            vec![],
        ))
        .unwrap();

    let duplicate = context(&repository, &[("공통보험", "POL-SAME")]);
    assert_eq!(duplicate.duplicate_candidates.len(), 1);
    let second = cells("둘째", "공통보험", "상품B", "POL-SAME", "2000");
    let result = repository
        .commit(request(
            &duplicate.snapshot_token,
            vec![row(
                2,
                second,
                ImportRowDecision::SeparateCreate {
                    customer: existing(CUSTOMER_B),
                },
            )],
            vec![],
        ))
        .unwrap();
    assert_eq!(result.created, 1);
    assert_eq!(counts(&repository), (2, 2, 2));
    let after = context(&repository, &[("공통보험", "POL-SAME")]);
    assert_eq!(after.duplicate_candidates.len(), 2);
}

#[test]
fn preserves_ecmascript_trim_and_nfc_for_reupload_duplicate_keys() {
    let repository = repository();
    seed_customer(&repository, CUSTOMER_A, "합성 고객");
    let raw_insurer = "\u{0085}A\u{030a}보험\u{0085}";
    let normalized_insurer = "\u{0085}Å보험\u{0085}";
    let source = cells("NEL", raw_insurer, "합성상품", "POL-NEL", "1000");
    let empty = context(&repository, &[(normalized_insurer, "POL-NEL")]);
    let created = repository
        .commit(request(
            &empty.snapshot_token,
            vec![row(2, source.clone(), create(CUSTOMER_A))],
            vec![],
        ))
        .unwrap();
    let target = policy_id(&created, 0);

    assert_eq!(
        policy_state(&repository, &target).insurer,
        normalized_insurer
    );
    assert_eq!(stored_source(&repository, &target), source_values(&source));
    let reupload = context(&repository, &[(normalized_insurer, "POL-NEL")]);
    assert_eq!(reupload.duplicate_candidates.len(), 1);
    assert_eq!(reupload.duplicate_candidates[0].policy_id, target);
}
