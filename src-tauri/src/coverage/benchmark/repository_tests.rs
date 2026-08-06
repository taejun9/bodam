use std::fs;
use std::path::{Path, PathBuf};
use std::sync::{Arc, Barrier};
use std::thread;

use rusqlite::params;
use uuid::Uuid;

use crate::coverage::CoverageRepository;
use crate::database;
use crate::error::AppError;

use super::model::{CoverageBenchmarkWrite, CreateCoverageBenchmarkInput};
use super::validation::validate_create;

const CATEGORY_ONE: &str = "10000000-0000-4000-8000-000000000001";
const CATEGORY_TWO: &str = "10000000-0000-4000-8000-000000000002";

#[test]
fn creates_lists_updates_soft_deletes_and_persists_decimal_strings() {
    let path = temp_path("crud");
    let repository = CoverageRepository::open(&path).expect("benchmark repository");
    let later = repository
        .create_benchmark(write(CATEGORY_ONE, "합성 성별", 30, 39, "50", "100"))
        .expect("create later benchmark");
    let maximum = repository
        .create_benchmark(write(
            CATEGORY_TWO,
            "합성 성별",
            20,
            29,
            "0",
            "9223372036854775807",
        ))
        .expect("create maximum benchmark");
    let earlier = repository
        .create_benchmark(write(CATEGORY_ONE, "합성 성별", 20, 29, "10", "20"))
        .expect("create earlier benchmark");

    let listed = repository.list_benchmarks().expect("benchmark list");
    assert_eq!(listed.len(), 3);
    assert_eq!(listed[0].id, earlier.id);
    assert_eq!(listed[1].id, later.id);
    assert_eq!(listed[2].id, maximum.id);
    assert_eq!(maximum.excessive_min_won, i64::MAX.to_string());
    assert!(listed.iter().all(|item| item.created_at.ends_with('Z')));
    let payload = serde_json::to_value(&maximum).expect("serialize benchmark");
    assert_eq!(payload["categoryId"], CATEGORY_TWO);
    assert_eq!(payload["adequateMinWon"], "0");
    assert_eq!(payload["excessiveMinWon"], i64::MAX.to_string());
    assert!(payload.get("category_id").is_none());

    let updated = repository
        .update_benchmark(
            &later.id,
            write(CATEGORY_ONE, "합성 성별", 30, 40, "60", "120"),
        )
        .expect("self-excluded update");
    assert_eq!(updated.max_age_years, 40);
    assert_eq!(updated.adequate_min_won, "60");

    repository
        .soft_delete_benchmark(&earlier.id)
        .expect("soft delete benchmark");
    assert_eq!(
        repository.list_benchmarks().expect("after deletion").len(),
        2
    );
    assert_eq!(
        repository.soft_delete_benchmark(&earlier.id),
        Err(AppError::CoverageBenchmarkNotFound)
    );
    drop(repository);

    let connection = database::open(&path).expect("inspect retained benchmark");
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverage_benchmarks
             WHERE id = ?1 AND deleted_at IS NOT NULL",
            [earlier.id],
            |row| row.get(0),
        )
        .expect("retained soft-deleted row");
    assert_eq!(retained, 1);
    drop(connection);
    let reopened = CoverageRepository::open(&path).expect("reopen repository");
    assert_eq!(reopened.list_benchmarks().expect("persisted list").len(), 2);
    drop(reopened);
    cleanup(&path);
}

#[test]
fn rejects_inclusive_overlap_but_allows_adjacent_distinct_and_reused_ranges() {
    let path = temp_path("overlap");
    let repository = CoverageRepository::open(&path).expect("benchmark repository");
    let first = repository
        .create_benchmark(write(CATEGORY_ONE, "합성 A", 0, 19, "50", "100"))
        .expect("create first range");
    assert_eq!(
        repository.create_benchmark(write(CATEGORY_ONE, "합성 A", 19, 29, "50", "100")),
        Err(AppError::CoverageBenchmarkConflict)
    );
    let adjacent = repository
        .create_benchmark(write(CATEGORY_ONE, "합성 A", 20, 29, "50", "100"))
        .expect("adjacent range");
    repository
        .create_benchmark(write(CATEGORY_ONE, "합성 B", 0, 19, "50", "100"))
        .expect("different exact gender");
    repository
        .create_benchmark(write(CATEGORY_TWO, "합성 A", 0, 19, "50", "100"))
        .expect("different category");

    repository
        .update_benchmark(&first.id, write(CATEGORY_ONE, "합성 A", 0, 19, "60", "120"))
        .expect("same id is excluded from overlap");
    assert_eq!(
        repository.update_benchmark(
            &adjacent.id,
            write(CATEGORY_ONE, "합성 A", 19, 29, "50", "100")
        ),
        Err(AppError::CoverageBenchmarkConflict)
    );
    assert_eq!(
        repository
            .list_benchmarks()
            .expect("unchanged after conflict")
            .into_iter()
            .find(|item| item.id == adjacent.id)
            .expect("adjacent benchmark")
            .min_age_years,
        20
    );

    repository
        .soft_delete_benchmark(&first.id)
        .expect("delete first range");
    repository
        .create_benchmark(write(CATEGORY_ONE, "합성 A", 0, 19, "50", "100"))
        .expect("reuse soft-deleted range");
    drop(repository);
    cleanup(&path);
}

#[test]
fn active_category_controls_visibility_and_mutation_without_deleting_child() {
    let path = temp_path("category-visibility");
    let repository = CoverageRepository::open(&path).expect("benchmark repository");
    let benchmark = repository
        .create_benchmark(write(CATEGORY_ONE, "합성 성별", 20, 29, "50", "100"))
        .expect("create benchmark");

    set_category_deleted(&path, CATEGORY_ONE, true);
    assert!(repository
        .list_benchmarks()
        .expect("hidden list")
        .is_empty());
    assert_eq!(
        repository.update_benchmark(
            &benchmark.id,
            write(CATEGORY_TWO, "합성 성별", 20, 29, "50", "100")
        ),
        Err(AppError::CoverageBenchmarkNotFound)
    );
    assert_eq!(
        repository.soft_delete_benchmark(&benchmark.id),
        Err(AppError::CoverageBenchmarkNotFound)
    );
    assert_eq!(
        repository.create_benchmark(write(CATEGORY_ONE, "합성 성별", 30, 39, "50", "100")),
        Err(AppError::CoverageCategoryNotFound)
    );

    set_category_deleted(&path, CATEGORY_ONE, false);
    assert_eq!(
        repository.list_benchmarks().expect("restored list").len(),
        1
    );
    assert_eq!(
        repository.create_benchmark(write(
            "10000000-0000-4000-8000-000000000099",
            "합성 성별",
            30,
            39,
            "50",
            "100"
        )),
        Err(AppError::CoverageCategoryNotFound)
    );
    let connection = database::open(&path).expect("foreign key database");
    assert!(connection
        .execute(
            "DELETE FROM coverage_categories WHERE id = ?1",
            [CATEGORY_ONE]
        )
        .is_err());
    let retained: i64 = connection
        .query_row(
            "SELECT COUNT(*) FROM coverage_benchmarks WHERE id = ?1",
            [benchmark.id],
            |row| row.get(0),
        )
        .expect("retained benchmark row");
    assert_eq!(retained, 1);
    drop(connection);
    drop(repository);
    cleanup(&path);
}

#[test]
fn immediate_transactions_serialize_cross_repository_overlap_checks() {
    let path = temp_path("concurrent-overlap");
    drop(database::open(&path).expect("migrated database"));
    let repositories = [
        CoverageRepository::open(&path).expect("first repository"),
        CoverageRepository::open(&path).expect("second repository"),
    ];
    let barrier = Arc::new(Barrier::new(2));
    let handles = repositories.map(|repository| {
        let barrier = Arc::clone(&barrier);
        thread::spawn(move || {
            barrier.wait();
            repository.create_benchmark(write(CATEGORY_ONE, "합성 동시성", 20, 29, "50", "100"))
        })
    });
    let results = handles.map(|handle| handle.join().expect("repository thread"));
    assert_eq!(results.iter().filter(|result| result.is_ok()).count(), 1);
    assert_eq!(
        results
            .iter()
            .filter(|result| **result == Err(AppError::CoverageBenchmarkConflict))
            .count(),
        1
    );
    cleanup(&path);
}

fn write(
    category_id: &str,
    gender: &str,
    min_age_years: i64,
    max_age_years: i64,
    adequate_min_won: &str,
    excessive_min_won: &str,
) -> CoverageBenchmarkWrite {
    validate_create(CreateCoverageBenchmarkInput {
        category_id: category_id.to_owned(),
        gender: gender.to_owned(),
        min_age_years,
        max_age_years,
        adequate_min_won: adequate_min_won.to_owned(),
        excessive_min_won: excessive_min_won.to_owned(),
    })
    .expect("valid synthetic benchmark")
}

fn temp_path(label: &str) -> PathBuf {
    std::env::temp_dir().join(format!(
        "bodam-benchmark-{label}-{}.sqlite3",
        Uuid::new_v4()
    ))
}

fn set_category_deleted(path: &Path, id: &str, deleted: bool) {
    let connection = database::open(path).expect("category state database");
    let deleted_at = deleted.then_some("2026-08-06T00:00:00.000Z");
    connection
        .execute(
            "UPDATE coverage_categories SET deleted_at = ?2 WHERE id = ?1",
            params![id, deleted_at],
        )
        .expect("update category state");
}

fn cleanup(path: &Path) {
    for suffix in ["", "-wal", "-shm"] {
        let candidate = format!("{}{suffix}", path.display());
        if fs::exists(&candidate).expect("check temporary database") {
            fs::remove_file(candidate).expect("remove temporary database");
        }
    }
}
