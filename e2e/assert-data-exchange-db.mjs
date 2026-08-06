import assert from "node:assert/strict";
import { isAbsolute } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

const databasePath = process.env.BODAM_E2E_DB_PATH;
const mode = process.env.BODAM_E2E_ASSERT_MODE;

if (
  !databasePath ||
  !isAbsolute(databasePath) ||
  !databasePath.endsWith(".sqlite3") ||
  !databasePath.includes("data-exchange")
) {
  throw new Error("BODAM_E2E_DB_PATH must identify a data-exchange temporary SQLite file");
}
if (!new Set(["xlsx", "csv", "empty"]).has(mode)) {
  throw new Error("BODAM_E2E_ASSERT_MODE must be xlsx, csv, or empty");
}

const sourceColumns = [
  "no",
  "collection_reflected_on",
  "affiliation",
  "manager",
  "collection_code",
  "contract",
  "insurer",
  "product_name",
  "policy_number",
  "contracted_on",
  "status",
  "final_payment_month",
  "payment_sequence",
  "payment_premium",
  "contractor",
  "insured",
  "coverage_starts_on",
  "coverage_ends_on",
  "collection_method",
  "payment_term",
  "original_recruiter_name",
];

const xlsxRow = Object.freeze({
  no: "1",
  collection_reflected_on: "2026-02-28",
  affiliation: "합성지점 하나",
  manager: "가상담당 하나",
  collection_code: "001234",
  contract: "장기",
  insurer: "가상손해보험",
  product_name: "합성안심플랜",
  policy_number: "00A-12345678901234567890",
  contracted_on: "2024-02-29",
  status: "유지",
  final_payment_month: "202602",
  payment_sequence: "012",
  payment_premium: "00120000",
  contractor: "합성계약자 하나",
  insured: "합성피보험자 하나",
  coverage_starts_on: "2024-02-29",
  coverage_ends_on: "2034-02-28",
  collection_method: null,
  payment_term: "10년",
  original_recruiter_name: "가상모집자 하나",
});

const csvRow = Object.freeze({
  no: "4",
  collection_reflected_on: "2026-08-06",
  affiliation: "가상,조직 \"넷\"",
  manager: "가상담당 넷",
  collection_code: "0000456",
  contract: "첫 줄\r\n둘째 줄",
  insurer: "가상생명보험",
  product_name: "합성CSV플랜",
  policy_number: "CSV-00000000000000000004",
  contracted_on: "2026-08-06",
  status: "유지",
  final_payment_month: "202608",
  payment_sequence: "001",
  payment_premium: "34000",
  contractor: "합성계약자 넷",
  insured: null,
  coverage_starts_on: "2026-08-06",
  coverage_ends_on: null,
  collection_method: null,
  payment_term: "20년",
  original_recruiter_name: "가상모집자 넷",
});

const database = new DatabaseSync(databasePath, { readOnly: true });
try {
  if (mode === "empty") {
    assertCounts(database, { customers: 0, policies: 0, sources: 0 });
  } else {
    assertCounts(database, { customers: 2, policies: 2, sources: 2 });
    const expected = mode === "xlsx" ? xlsxRow : csvRow;
    const productName = expected.product_name;
    const row = database.prepare(
      `SELECT ${sourceColumns.map((column) => `source.${column}`).join(", ")}
       FROM insurance_policy_import_sources AS source
       JOIN insurance_policies AS policy ON policy.id = source.policy_id
       WHERE policy.product_name = ?`,
    ).get(productName);
    assert.ok(row, `persisted import source missing for ${productName}`);
    assert.deepEqual(Object.keys(row).sort(), [...sourceColumns].sort());
    assert.deepEqual({ ...row }, expected);
  }
} finally {
  database.close();
}

function assertCounts(databaseConnection, expected) {
  const row = databaseConnection.prepare(
    `SELECT
       (SELECT COUNT(*) FROM customers) AS customers,
       (SELECT COUNT(*) FROM insurance_policies) AS policies,
       (SELECT COUNT(*) FROM insurance_policy_import_sources) AS sources`,
  ).get();
  assert.deepEqual({ ...row }, expected);
}
