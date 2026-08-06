use rusqlite::{Connection, Row};

use crate::error::AppError;

use super::commit_model::MappedContractPolicy;
use super::commit_validation::map_validated_source;
use super::constants::{HEADERS, MAX_DATA_ROWS, MAX_XLSX_LOGICAL_TEXT_BYTES};
use super::export_csv::cells_csv_allowed;
use super::export_model::{ContractExportRow, ContractExportSnapshot};
use super::model::ImportSourceCells;

pub(super) fn load_export_snapshot(
    connection: &Connection,
) -> Result<ContractExportSnapshot, AppError> {
    let mut statement = connection.prepare(EXPORT_QUERY)?;
    let candidates = statement.query_map([], query_candidate)?;
    let mut rows = Vec::new();
    let mut exportable_count = 0_u32;
    let mut missing_source_count = 0_u32;
    let mut conflict_count = 0_u32;
    let mut csv_allowed = true;
    let mut retained_bytes = HEADERS.iter().map(|value| value.len()).sum::<usize>();
    let mut generation_limit_exceeded = false;

    for candidate in candidates {
        let candidate = candidate?;
        let Some(cells) = candidate.cells else {
            missing_source_count = missing_source_count
                .checked_add(1)
                .ok_or(AppError::Database)?;
            continue;
        };
        if !source_matches_domain(&cells, &candidate.domain) {
            conflict_count = conflict_count.checked_add(1).ok_or(AppError::Database)?;
            continue;
        }
        exportable_count = exportable_count.checked_add(1).ok_or(AppError::Database)?;
        csv_allowed &= cells_csv_allowed(&cells);
        let row_bytes = retained_row_bytes(&cells);
        let next_retained_bytes = retained_bytes.checked_add(row_bytes);
        if rows.len() < MAX_DATA_ROWS
            && !generation_limit_exceeded
            && next_retained_bytes
                .is_some_and(|bytes| bytes <= MAX_XLSX_LOGICAL_TEXT_BYTES as usize)
        {
            retained_bytes = next_retained_bytes.unwrap_or(retained_bytes);
            rows.push(ContractExportRow { cells });
        } else if rows.len() < MAX_DATA_ROWS {
            generation_limit_exceeded = true;
        }
    }
    Ok(ContractExportSnapshot {
        rows,
        exportable_count,
        missing_source_count,
        conflict_count,
        csv_allowed,
        generation_limit_exceeded,
    })
}

fn retained_row_bytes(cells: &ImportSourceCells) -> usize {
    cells
        .values()
        .into_iter()
        .flatten()
        .fold(0, |total, value| total.saturating_add(value.len()))
}

struct QueryCandidate {
    domain: DomainFields,
    cells: Option<ImportSourceCells>,
}

struct DomainFields {
    insurer: String,
    product_name: String,
    joined_on: Option<String>,
    status: Option<String>,
    monthly_premium_won: i64,
    matures_on: Option<String>,
    payment_term: Option<String>,
}

fn query_candidate(row: &Row<'_>) -> rusqlite::Result<QueryCandidate> {
    let source_policy_id: Option<String> = row.get(7)?;
    let cells = source_policy_id
        .map(|_| read_source_cells(row))
        .transpose()?;
    Ok(QueryCandidate {
        domain: DomainFields {
            insurer: row.get(0)?,
            product_name: row.get(1)?,
            joined_on: row.get(2)?,
            status: row.get(3)?,
            monthly_premium_won: row.get(4)?,
            matures_on: row.get(5)?,
            payment_term: row.get(6)?,
        },
        cells,
    })
}

fn read_source_cells(row: &Row<'_>) -> rusqlite::Result<ImportSourceCells> {
    let mut columns: [Option<String>; 21] = std::array::from_fn(|_| None);
    for (index, value) in columns.iter_mut().enumerate() {
        *value = row.get(index + 8)?;
    }
    Ok(ImportSourceCells::from_columns(columns))
}

fn source_matches_domain(cells: &ImportSourceCells, domain: &DomainFields) -> bool {
    map_validated_source(cells).is_ok_and(|mapped| mapped_matches_domain(&mapped, domain))
}

fn mapped_matches_domain(mapped: &MappedContractPolicy, domain: &DomainFields) -> bool {
    mapped.insurer == domain.insurer
        && mapped.product_name == domain.product_name
        && mapped.joined_on == domain.joined_on
        && mapped.status == domain.status
        && mapped.monthly_premium_won == domain.monthly_premium_won.to_string()
        && mapped.matures_on == domain.matures_on
        && mapped.payment_term == domain.payment_term
}

const EXPORT_QUERY: &str = r#"
SELECT p.insurer, p.product_name, p.joined_on, p.status,
       p.monthly_premium_won, p.matures_on, p.payment_term, s.policy_id,
       s.no, s.collection_reflected_on, s.affiliation, s.manager,
       s.collection_code, s.contract, s.insurer, s.product_name,
       s.policy_number, s.contracted_on, s.status, s.final_payment_month,
       s.payment_sequence, s.payment_premium, s.contractor, s.insured,
       s.coverage_starts_on, s.coverage_ends_on, s.collection_method,
       s.payment_term, s.original_recruiter_name
FROM insurance_policies AS p
JOIN customers AS c ON c.id = p.customer_id AND c.deleted_at IS NULL
LEFT JOIN insurance_policy_import_sources AS s ON s.policy_id = p.id
WHERE p.deleted_at IS NULL
ORDER BY CASE WHEN p.joined_on IS NULL THEN 1 ELSE 0 END ASC,
         p.joined_on ASC, c.name ASC, p.id ASC
"#;
