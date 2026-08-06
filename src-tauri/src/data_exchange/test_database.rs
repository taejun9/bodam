use rusqlite::params;

use super::repository::DataExchangeRepository;

const COVERAGE_ID: &str = "71000000-0000-4000-8000-000000000001";
const CATEGORY_ID: &str = "10000000-0000-4000-8000-000000000001";

#[derive(Debug, Eq, PartialEq)]
pub(super) struct PolicyState {
    pub customer_id: String,
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

pub(super) fn repository() -> DataExchangeRepository {
    DataExchangeRepository::in_memory().expect("in-memory v8 database")
}

pub(super) fn seed_customer(repository: &DataExchangeRepository, id: &str, name: &str) {
    repository
        .lock()
        .unwrap()
        .execute(
            "INSERT INTO customers (id, name) VALUES (?1, ?2)",
            params![id, name],
        )
        .unwrap();
}

pub(super) fn counts(repository: &DataExchangeRepository) -> (i64, i64, i64) {
    let connection = repository.lock().unwrap();
    let count = |table: &str| {
        connection
            .query_row(&format!("SELECT COUNT(*) FROM {table}"), [], |row| {
                row.get(0)
            })
            .unwrap()
    };
    (
        count("customers"),
        count("insurance_policies"),
        count("insurance_policy_import_sources"),
    )
}

pub(super) fn customer_id_named(repository: &DataExchangeRepository, name: &str) -> String {
    repository
        .lock()
        .unwrap()
        .query_row("SELECT id FROM customers WHERE name = ?1", [name], |row| {
            row.get(0)
        })
        .unwrap()
}

pub(super) fn policy_state(repository: &DataExchangeRepository, id: &str) -> PolicyState {
    repository
        .lock()
        .unwrap()
        .query_row(
            "SELECT customer_id, insurer, product_name, joined_on, coverage_term,
                    payment_term, monthly_premium_won, disclosure_plan, matures_on,
                    renewable, status, is_included
             FROM insurance_policies WHERE id = ?1",
            [id],
            |row| {
                Ok(PolicyState {
                    customer_id: row.get(0)?,
                    insurer: row.get(1)?,
                    product_name: row.get(2)?,
                    joined_on: row.get(3)?,
                    coverage_term: row.get(4)?,
                    payment_term: row.get(5)?,
                    monthly_premium_won: row.get(6)?,
                    disclosure_plan: row.get(7)?,
                    matures_on: row.get(8)?,
                    renewable: row.get(9)?,
                    status: row.get(10)?,
                    is_included: row.get(11)?,
                })
            },
        )
        .unwrap()
}

pub(super) fn stored_source(repository: &DataExchangeRepository, id: &str) -> Vec<Option<String>> {
    repository
        .lock()
        .unwrap()
        .query_row(
            "SELECT no, collection_reflected_on, affiliation, manager, collection_code,
                    contract, insurer, product_name, policy_number, contracted_on, status,
                    final_payment_month, payment_sequence, payment_premium, contractor, insured,
                    coverage_starts_on, coverage_ends_on, collection_method, payment_term,
                    original_recruiter_name
             FROM insurance_policy_import_sources WHERE policy_id = ?1",
            [id],
            |row| (0..21).map(|index| row.get(index)).collect(),
        )
        .unwrap()
}

pub(super) fn set_manual_fields_and_coverage(repository: &DataExchangeRepository, id: &str) {
    let connection = repository.lock().unwrap();
    connection.execute(
        "UPDATE insurance_policies SET coverage_term = '수동보장', disclosure_plan = '수동고지',
                renewable = 1, is_included = 0, updated_at = '2030-01-01T00:00:00.000Z'
         WHERE id = ?1",
        [id],
    ).unwrap();
    connection.execute(
        "INSERT INTO coverages (id, policy_id, category_id, amount_won) VALUES (?1, ?2, ?3, 9000000)",
        params![COVERAGE_ID, id, CATEGORY_ID],
    ).unwrap();
}

pub(super) fn coverage_intact(repository: &DataExchangeRepository, policy_id: &str) -> bool {
    repository
        .lock()
        .unwrap()
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM coverages WHERE id = ?1 AND policy_id = ?2
                AND amount_won = 9000000 AND deleted_at IS NULL)",
            params![COVERAGE_ID, policy_id],
            |row| row.get(0),
        )
        .unwrap()
}

pub(super) fn soft_delete_customer(repository: &DataExchangeRepository, id: &str) {
    repository.lock().unwrap().execute(
        "UPDATE customers SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [id],
    ).unwrap();
}

pub(super) fn soft_delete_policy(repository: &DataExchangeRepository, id: &str) {
    repository.lock().unwrap().execute(
        "UPDATE insurance_policies SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = ?1",
        [id],
    ).unwrap();
}
