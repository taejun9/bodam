use rusqlite::{params, Connection};

use super::repository::DataExchangeRepository;

#[test]
fn classifies_active_rows_and_uses_normalized_stable_sort_keys() {
    let repository = DataExchangeRepository::in_memory().unwrap();
    let connection = repository.lock().unwrap();
    seed_customer(&connection, "customer-a", "A 고객", false, false);
    seed_customer(&connection, "customer-b", "B 고객", true, false);
    seed_customer(&connection, "customer-deleted", "삭제 고객", true, true);

    seed_policy(
        &connection,
        "policy-01",
        "customer-b",
        Some("2026-01-01"),
        false,
        false,
    );
    seed_source(
        &connection,
        "policy-01",
        Some("2026-01-01"),
        "1000",
        "합성상품",
    );
    seed_policy(
        &connection,
        "policy-02",
        "customer-b",
        Some("2025-12-31"),
        true,
        false,
    );
    seed_source(
        &connection,
        "policy-02",
        Some("2025-12-31"),
        "1000",
        "합성상품",
    );
    seed_policy(
        &connection,
        "policy-03",
        "customer-a",
        Some("2026-01-01"),
        true,
        false,
    );
    seed_source(
        &connection,
        "policy-03",
        Some(" \t2026-01-01\r\n"),
        "1000",
        "합성상품",
    );
    seed_policy(
        &connection,
        "policy-04",
        "customer-a",
        Some("2026-01-01"),
        true,
        false,
    );
    seed_source(
        &connection,
        "policy-04",
        Some("2026-01-01"),
        "1000",
        "합성상품",
    );
    seed_policy(&connection, "policy-05", "customer-a", None, true, false);
    seed_source(&connection, "policy-05", None, "1000", "합성상품");

    seed_policy(&connection, "manual", "customer-a", None, true, false);
    seed_policy(&connection, "conflict", "customer-a", None, true, false);
    seed_source(&connection, "conflict", None, "1000", "다른상품");
    seed_policy(
        &connection,
        "invalid-source",
        "customer-a",
        None,
        true,
        false,
    );
    seed_source(
        &connection,
        "invalid-source",
        None,
        "not-a-number",
        "합성상품",
    );
    seed_policy(&connection, "empty-source", "customer-a", None, true, false);
    seed_source(&connection, "empty-source", None, "1000", "합성상품");
    connection
        .execute(
            "UPDATE insurance_policy_import_sources SET manager = ''
             WHERE policy_id = 'empty-source'",
            [],
        )
        .unwrap();

    seed_policy(
        &connection,
        "deleted-policy",
        "customer-a",
        None,
        true,
        true,
    );
    seed_source(&connection, "deleted-policy", None, "1000", "합성상품");
    seed_policy(
        &connection,
        "deleted-parent-policy",
        "customer-deleted",
        None,
        true,
        false,
    );
    seed_source(
        &connection,
        "deleted-parent-policy",
        None,
        "1000",
        "합성상품",
    );
    drop(connection);

    let snapshot = repository.export_snapshot().unwrap();
    assert_eq!(snapshot.exportable_count, 5);
    assert_eq!(snapshot.missing_source_count, 1);
    assert_eq!(snapshot.conflict_count, 3);
    assert_eq!(
        snapshot
            .rows
            .iter()
            .map(|row| row.cells.no.as_deref().unwrap())
            .collect::<Vec<_>>(),
        [
            "policy-02",
            "policy-03",
            "policy-04",
            "policy-01",
            "policy-05"
        ]
    );
    assert!(snapshot.csv_allowed);
    assert!(!snapshot.generation_limit_exceeded);
}

#[test]
fn streams_all_counts_but_retains_at_most_five_thousand_rows() {
    let repository = DataExchangeRepository::in_memory().unwrap();
    let connection = repository.lock().unwrap();
    let long_sort_only_customer_name = "가".repeat(120);
    seed_customer(
        &connection,
        "customer",
        &long_sort_only_customer_name,
        true,
        false,
    );
    connection.execute_batch("BEGIN").unwrap();
    for index in 0..5_002 {
        let policy_id = format!("policy-{index:05}");
        seed_policy(&connection, &policy_id, "customer", None, true, false);
        seed_source(&connection, &policy_id, None, "1000", "합성상품");
    }
    let near_logical_limit = "x".repeat(3_990);
    connection
        .execute(
            "UPDATE insurance_policy_import_sources SET affiliation = ?1",
            [near_logical_limit],
        )
        .unwrap();
    connection
        .execute(
            "UPDATE insurance_policy_import_sources SET manager = '=hidden'
             WHERE policy_id = 'policy-05001'",
            [],
        )
        .unwrap();
    connection.execute_batch("COMMIT").unwrap();
    drop(connection);

    let snapshot = repository.export_snapshot().unwrap();
    assert_eq!(snapshot.exportable_count, 5_002);
    assert_eq!(snapshot.rows.len(), 5_000);
    assert_eq!(snapshot.missing_source_count, 0);
    assert_eq!(snapshot.conflict_count, 0);
    assert!(!snapshot.csv_allowed);
    // Sort-only customer/policy identities are not XLSX cell text and must not
    // cause a valid source payload near the logical limit to be rejected.
    assert!(!snapshot.generation_limit_exceeded);
}

#[test]
fn bounds_retained_text_before_generation_for_compressible_large_sources() {
    let repository = DataExchangeRepository::in_memory().unwrap();
    let connection = repository.lock().unwrap();
    seed_customer(&connection, "customer", "합성 고객", true, false);
    let large_text = "가".repeat(4_000);
    connection.execute_batch("BEGIN").unwrap();
    for index in 0..1_800 {
        let policy_id = format!("large-{index:05}");
        seed_policy(&connection, &policy_id, "customer", None, true, false);
        seed_source(&connection, &policy_id, None, "1000", "합성상품");
        connection
            .execute(
                "UPDATE insurance_policy_import_sources SET affiliation = ?1
                 WHERE policy_id = ?2",
                params![large_text, policy_id],
            )
            .unwrap();
    }
    connection.execute_batch("COMMIT").unwrap();
    drop(connection);

    let snapshot = repository.export_snapshot().unwrap();
    assert_eq!(snapshot.exportable_count, 1_800);
    assert!(snapshot.rows.len() < 1_800);
    assert!(snapshot.generation_limit_exceeded);
}

fn seed_customer(connection: &Connection, id: &str, name: &str, is_managed: bool, deleted: bool) {
    connection
        .execute(
            "INSERT INTO customers (id, name, is_managed, deleted_at)
             VALUES (?1, ?2, ?3, ?4)",
            params![id, name, is_managed, deleted.then_some("2030-01-01")],
        )
        .unwrap();
}

fn seed_policy(
    connection: &Connection,
    id: &str,
    customer_id: &str,
    joined_on: Option<&str>,
    is_included: bool,
    deleted: bool,
) {
    connection
        .execute(
            "INSERT INTO insurance_policies
             (id, customer_id, insurer, product_name, joined_on, coverage_term,
              payment_term, monthly_premium_won, disclosure_plan, renewable,
              is_included, deleted_at)
             VALUES (?1, ?2, '합성보험', '합성상품', ?3, '수동보장', NULL,
                     1000, '수동고지', 1, ?4, ?5)",
            params![
                id,
                customer_id,
                joined_on,
                is_included,
                deleted.then_some("2030-01-01")
            ],
        )
        .unwrap();
}

fn seed_source(
    connection: &Connection,
    policy_id: &str,
    contracted_on: Option<&str>,
    premium: &str,
    product_name: &str,
) {
    connection
        .execute(
            "INSERT INTO insurance_policy_import_sources
             (policy_id, no, insurer, product_name, contracted_on, payment_premium)
             VALUES (?1, ?1, '합성보험', ?2, ?3, ?4)",
            params![policy_id, product_name, contracted_on, premium],
        )
        .unwrap();
}
