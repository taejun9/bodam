use crate::error::AppError;

use super::{cleanup, temp_path, CoverageRepository, CATEGORY_ONE, CATEGORY_TWO};
use crate::coverage::model::UpdateCoverageCategoryInput;
use crate::coverage::validation::validate_category_update;

#[test]
fn lists_renames_and_soft_deletes_seed_categories_without_merging_names() {
    let path = temp_path("category-lifecycle");
    let repository = CoverageRepository::open(&path).expect("coverage repository");

    let categories = repository.list_categories().expect("seed categories");
    assert_eq!(categories.len(), 10);
    assert_eq!(categories[0].id, CATEGORY_ONE);
    assert_eq!(categories[9].id, "10000000-0000-4000-8000-000000000010");
    assert!(categories
        .iter()
        .all(|category| category.created_at.ends_with('Z')));
    let payload = serde_json::to_value(&categories[0]).expect("serialize category");
    assert!(payload["createdAt"].is_string());
    assert!(payload.get("created_at").is_none());

    let renamed = repository
        .update_category(
            CATEGORY_ONE,
            validate_category_update(UpdateCoverageCategoryInput {
                name: "  합성 공통명  ".to_owned(),
            })
            .expect("valid category name"),
        )
        .expect("rename first category");
    repository
        .update_category(
            CATEGORY_TWO,
            validate_category_update(UpdateCoverageCategoryInput {
                name: "합성 공통명".to_owned(),
            })
            .expect("duplicate names remain distinct"),
        )
        .expect("rename second category");
    assert_eq!(renamed.name, "합성 공통명");
    assert_eq!(
        repository
            .list_categories()
            .expect("renamed category list")
            .iter()
            .filter(|category| category.name == "합성 공통명")
            .count(),
        2
    );

    repository
        .soft_delete_category(CATEGORY_ONE)
        .expect("soft delete category");
    assert_eq!(
        repository
            .list_categories()
            .expect("active categories")
            .len(),
        9
    );
    assert_eq!(
        repository.soft_delete_category(CATEGORY_ONE),
        Err(AppError::CoverageCategoryNotFound)
    );
    drop(repository);

    let reopened = CoverageRepository::open(&path).expect("reopen repository");
    assert_eq!(
        reopened
            .list_categories()
            .expect("persisted deletion")
            .len(),
        9
    );
    drop(reopened);
    cleanup(&path);
}
