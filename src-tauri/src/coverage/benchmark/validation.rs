use std::collections::BTreeMap;

use uuid::Uuid;

use crate::error::AppError;
use crate::text::trim_ecmascript_whitespace;

use super::model::{
    CoverageBenchmarkWrite, CreateCoverageBenchmarkInput, UpdateCoverageBenchmarkInput,
};

pub(crate) const MAX_GENDER_CHARS: usize = 100;
pub(crate) const MAX_AGE_YEARS: i64 = 150;

pub(crate) fn validate_create(
    input: CreateCoverageBenchmarkInput,
) -> Result<CoverageBenchmarkWrite, AppError> {
    validate_write(
        input.category_id,
        input.gender,
        input.min_age_years,
        input.max_age_years,
        input.adequate_min_won,
        input.excessive_min_won,
    )
}

pub(crate) fn validate_update(
    input: UpdateCoverageBenchmarkInput,
) -> Result<CoverageBenchmarkWrite, AppError> {
    validate_write(
        input.category_id,
        input.gender,
        input.min_age_years,
        input.max_age_years,
        input.adequate_min_won,
        input.excessive_min_won,
    )
}

pub(crate) fn validate_benchmark_id(id: String) -> Result<String, AppError> {
    if !is_canonical_uuid(&id) {
        return Err(validation_error(
            "id",
            "올바른 보장 기준 식별자가 필요합니다.",
        ));
    }
    Ok(id)
}

fn validate_write(
    category_id: String,
    gender: String,
    min_age_years: i64,
    max_age_years: i64,
    adequate_min_won: String,
    excessive_min_won: String,
) -> Result<CoverageBenchmarkWrite, AppError> {
    let mut fields = BTreeMap::new();
    if !is_canonical_uuid(&category_id) {
        fields.insert(
            "categoryId".to_owned(),
            "올바른 보장 카테고리 식별자가 필요합니다.".to_owned(),
        );
    }
    let gender = trim_ecmascript_whitespace(&gender).to_owned();
    if gender.is_empty() {
        fields.insert("gender".to_owned(), "성별을 입력해 주세요.".to_owned());
    } else if gender.chars().count() > MAX_GENDER_CHARS {
        fields.insert(
            "gender".to_owned(),
            "성별은 100자 이내로 입력해 주세요.".to_owned(),
        );
    }
    validate_age("minAgeYears", min_age_years, &mut fields);
    validate_age("maxAgeYears", max_age_years, &mut fields);
    if (0..=MAX_AGE_YEARS).contains(&min_age_years)
        && (0..=MAX_AGE_YEARS).contains(&max_age_years)
        && min_age_years > max_age_years
    {
        fields.insert(
            "maxAgeYears".to_owned(),
            "끝 나이는 시작 나이 이상이어야 합니다.".to_owned(),
        );
    }
    let adequate_min_won = parse_money("adequateMinWon", &adequate_min_won, &mut fields);
    let excessive_min_won = parse_money("excessiveMinWon", &excessive_min_won, &mut fields);
    if let (Some(adequate), Some(excessive)) = (adequate_min_won, excessive_min_won) {
        if adequate >= excessive {
            fields.insert(
                "excessiveMinWon".to_owned(),
                "과다 하한은 적정 하한보다 커야 합니다.".to_owned(),
            );
        }
    }
    if !fields.is_empty() {
        return Err(AppError::Validation(fields));
    }
    Ok(CoverageBenchmarkWrite {
        category_id,
        gender,
        min_age_years,
        max_age_years,
        adequate_min_won: adequate_min_won.expect("validated adequate money"),
        excessive_min_won: excessive_min_won.expect("validated excessive money"),
    })
}

fn validate_age(field: &str, value: i64, fields: &mut BTreeMap<String, String>) {
    if !(0..=MAX_AGE_YEARS).contains(&value) {
        fields.insert(
            field.to_owned(),
            "나이는 0부터 150 사이의 정수여야 합니다.".to_owned(),
        );
    }
}

fn parse_money(field: &str, value: &str, fields: &mut BTreeMap<String, String>) -> Option<i64> {
    let bytes = value.as_bytes();
    let canonical = bytes == b"0"
        || bytes
            .first()
            .is_some_and(|first| (b'1'..=b'9').contains(first))
            && bytes[1..].iter().all(u8::is_ascii_digit);
    if !canonical {
        fields.insert(
            field.to_owned(),
            "금액은 0 이상의 원 단위 정수여야 합니다.".to_owned(),
        );
        return None;
    }
    match value.parse::<i64>() {
        Ok(parsed) => Some(parsed),
        Err(_) => {
            fields.insert(
                field.to_owned(),
                "금액이 저장 가능한 범위를 넘었습니다.".to_owned(),
            );
            None
        }
    }
}

fn is_canonical_uuid(value: &str) -> bool {
    Uuid::parse_str(value)
        .map(|parsed| parsed.hyphenated().to_string() == value)
        .unwrap_or(false)
}

fn validation_error(field: &str, message: &str) -> AppError {
    AppError::Validation(BTreeMap::from([(field.to_owned(), message.to_owned())]))
}
