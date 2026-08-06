use rusqlite::params;

use crate::database;
use crate::error::AppError;

use super::{cleanup, create_family, temp_path, FamilyRepository};

#[test]
fn creates_orders_searches_updates_and_soft_deletes_families() {
    let path = temp_path("family-lifecycle");
    let repository = FamilyRepository::open(&path).expect("family repository");
    let beta = create_family(&repository, "합성 나 가족");
    let alpha_one = create_family(&repository, "합성 가 가족");
    let alpha_two = create_family(&repository, "합성 가 가족");

    let all = repository.list(None).expect("list families");
    assert_eq!(all.len(), 3);
    let mut duplicate_ids = [alpha_one.id.clone(), alpha_two.id.clone()];
    duplicate_ids.sort();
    assert_eq!(
        all.iter()
            .take(2)
            .map(|family| &family.id)
            .collect::<Vec<_>>(),
        duplicate_ids.iter().collect::<Vec<_>>()
    );
    assert_eq!(all[2].id, beta.id);

    assert_eq!(
        repository
            .list(Some(" 가 ".to_owned()))
            .expect("search families")
            .len(),
        2
    );
    assert!(repository
        .list(Some("%".to_owned()))
        .expect("literal wildcard")
        .is_empty());

    let updated = repository
        .update(&beta.id, "합성 다 가족".to_owned())
        .expect("update family");
    assert_eq!(updated.name, "합성 다 가족");
    assert_eq!(
        repository.soft_delete(&beta.id).expect("delete family").id,
        beta.id
    );
    assert_eq!(
        repository.soft_delete(&beta.id),
        Err(AppError::FamilyNotFound)
    );
    assert_eq!(repository.list(None).expect("active families").len(), 2);

    let connection = database::open(&path).expect("inspect retained family");
    let retained: (String, bool) = connection
        .query_row(
            "SELECT name, deleted_at IS NOT NULL FROM families WHERE id = ?1",
            params![beta.id],
            |row| Ok((row.get(0)?, row.get(1)?)),
        )
        .expect("retained family row");
    assert_eq!(retained, ("합성 다 가족".to_owned(), true));
    drop(connection);
    drop(repository);
    cleanup(&path);
}

#[test]
fn search_folds_ascii_but_keeps_non_ascii_case_exact() {
    let path = temp_path("family-search-nocase");
    let repository = FamilyRepository::open(&path).expect("family repository");
    create_family(&repository, "Élodie Family");

    assert_eq!(
        repository
            .list(Some("ÉLODIE FAMILY".to_owned()))
            .unwrap()
            .len(),
        1
    );
    assert!(repository.list(Some("é".to_owned())).unwrap().is_empty());
    drop(repository);
    cleanup(&path);
}

#[test]
fn file_repository_persists_across_reopen() {
    let path = temp_path("persistence");
    let id = {
        let repository = FamilyRepository::open(&path).expect("open family repository");
        create_family(&repository, "합성 영속 가족").id
    };
    let reopened = FamilyRepository::open(&path).expect("reopen family repository");
    assert_eq!(reopened.list(None).expect("persisted families")[0].id, id);
    drop(reopened);
    cleanup(&path);
}
