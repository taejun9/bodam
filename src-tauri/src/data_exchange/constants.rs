pub(crate) const TARGET_SHEET: &str = "계약조회(엑셀변환)_장기";

pub(crate) const HEADERS: [&str; 21] = [
    "No",
    "수금반영일",
    "소속",
    "담당자",
    "수금인코드",
    "계약",
    "보험사",
    "상품명",
    "증권번호",
    "계약일자",
    "상태",
    "최종납월",
    "납입회차",
    "납입보험료",
    "계약자",
    "피보험자",
    "보험시기",
    "보험종기",
    "수금방법",
    "납기",
    "원모집자명",
];

pub(crate) const FIELD_KEYS: [&str; 21] = [
    "no",
    "collectionReflectedOn",
    "affiliation",
    "manager",
    "collectionCode",
    "contract",
    "insurer",
    "productName",
    "policyNumber",
    "contractedOn",
    "status",
    "finalPaymentMonth",
    "paymentSequence",
    "paymentPremium",
    "contractor",
    "insured",
    "coverageStartsOn",
    "coverageEndsOn",
    "collectionMethod",
    "paymentTerm",
    "originalRecruiterName",
];

pub(crate) const MAX_FILE_BYTES: u64 = 10 * 1024 * 1024;
pub(crate) const MAX_ARCHIVE_ENTRIES: usize = 1_000;
pub(crate) const MAX_ARCHIVE_ENTRY_BYTES: u64 = 20 * 1024 * 1024;
pub(crate) const MAX_ARCHIVE_TOTAL_BYTES: u64 = 50 * 1024 * 1024;
pub(crate) const MAX_DATA_ROWS: usize = 5_000;
pub(crate) const MAX_CELL_SCALARS: usize = 4_000;
pub(crate) const MAX_XLSX_LOGICAL_TEXT_BYTES: u64 = 20 * 1024 * 1024;
pub(crate) const MAX_XLSX_SHARED_STRINGS: usize = (MAX_DATA_ROWS + 1) * HEADERS.len();
