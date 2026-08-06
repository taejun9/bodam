use super::commit_model::{ImportCustomerReference, ImportRowDecision};
use super::commit_validation::validate_commit_request;
use super::test_support::{cells, request, row, CUSTOMER_A};

fn valid_request() -> super::commit_model::ImportCommitRequest {
    request(
        &"0".repeat(64),
        vec![row(
            2,
            cells("summary", "합성보험", "합성상품", "POL-SUMMARY", "1000"),
            ImportRowDecision::Create {
                customer: ImportCustomerReference::Existing {
                    customer_id: CUSTOMER_A.to_owned(),
                },
            },
        )],
        vec![],
    )
}

#[test]
fn rejects_overflowing_or_out_of_range_summary_counts() {
    for (invalid_rows, unselected_rows, total_rows) in [
        (u32::MAX, 0, 0),
        (5_001, 0, 5_002),
        (0, 5_001, 5_002),
        (0, 0, 5_001),
    ] {
        let mut candidate = valid_request();
        candidate.summary.invalid_rows = invalid_rows;
        candidate.summary.unselected_rows = unselected_rows;
        candidate.summary.total_rows = total_rows;
        assert!(validate_commit_request(candidate).is_err());
    }
}

#[test]
fn rejects_source_rows_outside_the_frontend_integer_contract() {
    let mut candidate = valid_request();
    candidate.rows[0].source.source_row = i32::MAX as u32 + 1;

    assert!(validate_commit_request(candidate).is_err());
}
