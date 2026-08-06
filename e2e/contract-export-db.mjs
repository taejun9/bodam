import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, extname, isAbsolute } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";

export const contractHeaders = Object.freeze([
  "No", "수금반영일", "소속", "담당자", "수금인코드", "계약", "보험사",
  "상품명", "증권번호", "계약일자", "상태", "최종납월", "납입회차",
  "납입보험료", "계약자", "피보험자", "보험시기", "보험종기", "수금방법",
  "납기", "원모집자명",
]);

const sourceColumns = Object.freeze([
  "no", "collection_reflected_on", "affiliation", "manager", "collection_code",
  "contract", "insurer", "product_name", "policy_number", "contracted_on",
  "status", "final_payment_month", "payment_sequence", "payment_premium",
  "contractor", "insured", "coverage_starts_on", "coverage_ends_on",
  "collection_method", "payment_term", "original_recruiter_name",
]);

export function exportAssertionEnvironment() {
  const databasePath = process.env.BODAM_E2E_DB_PATH;
  const exportPath = process.env.BODAM_E2E_EXPORT_PATH;
  const snapshotPath = process.env.BODAM_E2E_EXPORT_SNAPSHOT_PATH;
  const format = process.env.BODAM_E2E_EXPORT_FORMAT;
  assert.ok(databasePath && isAbsolute(databasePath));
  assert.ok(exportPath && isAbsolute(exportPath));
  assert.ok(snapshotPath && isAbsolute(snapshotPath));
  assert.ok(new Set(["xlsx", "csv"]).has(format));
  assert.equal(dirname(exportPath), dirname(databasePath));
  assert.equal(dirname(snapshotPath), dirname(databasePath));
  assert.match(basename(exportPath), /^synthetic-[A-Za-z0-9._-]+\.(xlsx|csv)$/);
  assert.equal(extname(exportPath).toLowerCase(), `.${format}`);
  assert.match(basename(snapshotPath), /^synthetic-[A-Za-z0-9._-]+\.json$/);
  return { databasePath, exportPath, snapshotPath, format };
}

export function assertRegularExport(path) {
  const metadata = lstatSync(path);
  assert.equal(metadata.isFile(), true);
  assert.equal(metadata.isSymbolicLink(), false);
  assert.ok(metadata.size > 0 && metadata.size <= 10 * 1024 * 1024);
}

export function expectedExportRows(databasePath) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const select = sourceColumns.map((column) => `source.${quote(column)}`).join(", ");
    const rows = database.prepare(
      `SELECT ${select},
              policy.id AS policy_id,
              customer.name AS customer_name,
              policy.insurer AS domain_insurer,
              policy.product_name AS domain_product_name,
              policy.joined_on AS domain_joined_on,
              policy.status AS domain_status,
              policy.monthly_premium_won AS domain_monthly_premium_won,
              policy.matures_on AS domain_matures_on,
              policy.payment_term AS domain_payment_term
       FROM insurance_policy_import_sources AS source
       JOIN insurance_policies AS policy ON policy.id = source.policy_id
       JOIN customers AS customer ON customer.id = policy.customer_id
       WHERE policy.deleted_at IS NULL AND customer.deleted_at IS NULL`,
    ).all();
    return rows
      .filter(hasDomainParity)
      .sort(compareExportRows)
      .map((row) => sourceColumns.map((column) => row[column] ?? null));
  } finally {
    database.close();
  }
}

function hasDomainParity(row) {
  return normalizedRequired(row.insurer) === row.domain_insurer
    && normalizedRequired(row.product_name) === row.domain_product_name
    && normalizedOptional(row.contracted_on) === row.domain_joined_on
    && normalizedOptional(row.status) === row.domain_status
    && normalizedPremium(row.payment_premium) === String(row.domain_monthly_premium_won)
    && normalizedOptional(row.coverage_ends_on) === row.domain_matures_on
    && normalizedOptional(row.payment_term) === row.domain_payment_term;
}

function normalizedRequired(value) {
  return String(value ?? "").trim().normalize("NFC");
}

function normalizedOptional(value) {
  const normalized = normalizedRequired(value);
  return normalized === "" ? null : normalized;
}

function normalizedPremium(value) {
  const normalized = normalizedRequired(value);
  assert.match(normalized, /^\d+$/);
  return BigInt(normalized).toString();
}

function compareExportRows(left, right) {
  const leftDate = normalizedOptional(left.contracted_on);
  const rightDate = normalizedOptional(right.contracted_on);
  if (leftDate === null && rightDate !== null) return 1;
  if (leftDate !== null && rightDate === null) return -1;
  return compareText(leftDate, rightDate)
    || compareText(left.customer_name, right.customer_name)
    || compareText(left.policy_id, right.policy_id);
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

export function writeLogicalSnapshot(databasePath, snapshotPath, options = {}) {
  writeFileSync(snapshotPath, `${JSON.stringify(logicalSnapshot(databasePath, options))}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function assertLogicalSnapshot(databasePath, snapshotPath, options = {}) {
  const expected = JSON.parse(readFileSync(snapshotPath, "utf8"));
  assert.deepEqual(logicalSnapshot(databasePath, options), expected);
}

export function logicalSnapshot(databasePath, { clearHostLocalBackupDirectory = false } = {}) {
  const database = new DatabaseSync(databasePath, { readOnly: true });
  try {
    const tables = database.prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name NOT LIKE 'sqlite_%'
       ORDER BY name`,
    ).all().map(({ name }) => name);
    const hash = createHash("sha256");
    const counts = {};
    for (const table of tables) {
      const columns = database.prepare(
        "SELECT name FROM pragma_table_info(?) ORDER BY cid",
      ).all(table).map(({ name }) => name);
      const rows = database.prepare(
        `SELECT ${columns.map(quote).join(", ")} FROM ${quote(table)}`,
      ).all().map((row) => JSON.stringify(columns.map((column) => encode(
        clearHostLocalBackupDirectory && table === "app_settings" &&
          column === "custom_backup_directory" ? null : row[column],
      ))));
      rows.sort();
      counts[table] = rows.length;
      hash.update(JSON.stringify([table, columns, rows]));
    }
    return { version: 1, digest: hash.digest("hex"), counts };
  } finally {
    database.close();
  }
}

function encode(value) {
  if (value === null) return ["null"];
  if (value instanceof Uint8Array) return ["blob", Buffer.from(value).toString("hex")];
  return [typeof value, String(value)];
}

function quote(identifier) {
  return `"${identifier.replaceAll('"', '""')}"`;
}
