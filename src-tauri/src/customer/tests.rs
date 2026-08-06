use std::fs;

use rusqlite::params;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::database;
use crate::error::AppError;

use super::model::{CreateCustomerInput, UpdateCustomerInput};
use super::validation::{validate_create, validate_update};
use super::CustomerRepository;

fn create_input(name: &str) -> CreateCustomerInput {
    CreateCustomerInput {
        name: name.to_owned(),
        birth_date: Some("2000-01-02".to_owned()),
        gender: Some("Synthetic".to_owned()),
        phone: Some("TEST-0001".to_owned()),
        address: Some("Synthetic address".to_owned()),
        memo: Some("Synthetic memo".to_owned()),
        status: Some("Follow-up".to_owned()),
        is_managed: true,
    }
}

#[test]
fn creates_lists_searches_updates_and_soft_deletes() {
    let repository = CustomerRepository::in_memory().expect("in-memory repository");
    let alpha = repository
        .create(validate_create(create_input("Synthetic Alpha")).expect("valid alpha"))
        .expect("create alpha");
    let mut beta_input = create_input("Synthetic Beta");
    beta_input.phone = Some("TEST-0002".to_owned());
    beta_input.status = Some("Inactive".to_owned());
    let beta = repository
        .create(validate_create(beta_input).expect("valid beta"))
        .expect("create beta");

    let all = repository.list(None).expect("list customers");
    assert_eq!(all.len(), 2);
    assert_eq!(all[0].id, alpha.id);
    assert_eq!(all[1].id, beta.id);

    let by_name = repository
        .list(Some(" alpha ".to_owned()))
        .expect("search name");
    assert_eq!(by_name.len(), 1);
    assert_eq!(by_name[0].id, alpha.id);
    let by_phone = repository
        .list(Some("0002".to_owned()))
        .expect("search phone");
    assert_eq!(by_phone[0].id, beta.id);
    let literal_wildcard = repository
        .list(Some("%".to_owned()))
        .expect("search literal wildcard");
    assert!(literal_wildcard.is_empty());

    let updated = repository
        .update(
            &alpha.id,
            validate_update(UpdateCustomerInput {
                name: " Synthetic Updated ".to_owned(),
                birth_date: None,
                gender: None,
                phone: None,
                address: None,
                memo: None,
                status: Some(" Complete ".to_owned()),
                is_managed: false,
            })
            .expect("valid update"),
        )
        .expect("update alpha");
    assert_eq!(updated.name, "Synthetic Updated");
    assert_eq!(updated.birth_date, None);
    assert_eq!(updated.status.as_deref(), Some("Complete"));
    assert!(!updated.is_managed);

    let deleted = repository.soft_delete(&beta.id).expect("soft delete beta");
    assert_eq!(deleted.id, beta.id);
    assert_eq!(repository.list(None).expect("active only").len(), 1);
    assert_eq!(
        repository.soft_delete(&beta.id),
        Err(AppError::CustomerNotFound)
    );
}

#[test]
fn update_ipc_requires_all_fields_and_accepts_explicit_null() {
    let complete = || {
        json!({
            "name": "Synthetic Update",
            "birthDate": null,
            "gender": null,
            "phone": null,
            "address": null,
            "memo": null,
            "status": null,
            "isManaged": false
        })
    };
    let parsed: UpdateCustomerInput =
        serde_json::from_value(complete()).expect("explicit null update fields");
    let write = validate_update(parsed).expect("valid complete update");
    assert_eq!(write.birth_date, None);
    assert!(!write.is_managed);

    for field in [
        "name",
        "birthDate",
        "gender",
        "phone",
        "address",
        "memo",
        "status",
        "isManaged",
    ] {
        let mut missing = complete();
        missing
            .as_object_mut()
            .expect("object payload")
            .remove(field);
        assert!(
            serde_json::from_value::<UpdateCustomerInput>(missing).is_err(),
            "missing {field} must be rejected"
        );
    }
}

#[test]
fn ipc_inputs_reject_unknown_fields_while_create_defaults_remain() {
    let minimal: CreateCustomerInput = serde_json::from_value(json!({
        "name": "Synthetic Minimal"
    }))
    .expect("create defaults remain supported");
    assert!(minimal.is_managed);
    assert_eq!(minimal.memo, None);

    assert!(serde_json::from_value::<CreateCustomerInput>(json!({
        "name": "Synthetic Create",
        "rogue": "synthetic-marker"
    }))
    .is_err());
    assert!(serde_json::from_value::<UpdateCustomerInput>(json!({
        "name": "Synthetic Update",
        "birthDate": null,
        "gender": null,
        "phone": null,
        "address": null,
        "memo": null,
        "status": null,
        "isManaged": true,
        "rogue": "synthetic-marker"
    }))
    .is_err());
}

#[test]
fn file_database_persists_across_repository_reopen() {
    let path = std::env::temp_dir().join(format!("bodam-synthetic-{}.sqlite3", Uuid::new_v4()));
    let customer_id = {
        let repository = CustomerRepository::open(&path).expect("open file repository");
        repository
            .create(validate_create(create_input("Synthetic Persistent")).expect("valid customer"))
            .expect("persist customer")
            .id
    };

    let reopened = CustomerRepository::open(&path).expect("reopen file repository");
    let customers = reopened.list(None).expect("list persisted customer");
    assert_eq!(customers.len(), 1);
    assert_eq!(customers[0].id, customer_id);
    drop(reopened);

    remove_database_files(&path);
}

#[test]
fn prisma_default_timestamps_are_normalized_for_the_ipc_json_contract() {
    let path = std::env::temp_dir().join(format!(
        "bodam-synthetic-timestamp-{}.sqlite3",
        Uuid::new_v4()
    ));
    let raw_timestamp = {
        let connection = database::open(&path).expect("open migrated fixture database");
        connection
            .execute(
                r#"INSERT INTO customers (id, name, is_managed)
                   VALUES (?1, ?2, true)"#,
                params!["synthetic-current-timestamp", "Synthetic Timestamp"],
            )
            .expect("insert row using Prisma migration defaults");
        connection
            .query_row(
                "SELECT created_at FROM customers WHERE id = ?1",
                ["synthetic-current-timestamp"],
                |row| row.get::<_, String>(0),
            )
            .expect("read raw default timestamp")
    };
    assert_eq!(raw_timestamp.len(), 19);
    assert_eq!(raw_timestamp.as_bytes()[10], b' ');

    let repository = CustomerRepository::open(&path).expect("reopen fixture repository");
    let customer = repository
        .list(None)
        .expect("read normalized fixture")
        .pop()
        .expect("synthetic fixture customer");
    let payload = serde_json::to_value(customer).expect("serialize IPC response");
    let expected = format!("{}T{}.000Z", &raw_timestamp[..10], &raw_timestamp[11..]);
    assert_eq!(payload["createdAt"], Value::String(expected.clone()));
    assert_eq!(payload["updatedAt"], Value::String(expected));

    drop(repository);
    remove_database_files(&path);
}

fn remove_database_files(path: &std::path::Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database file") {
            fs::remove_file(candidate).expect("remove temporary database file");
        }
    }
}
