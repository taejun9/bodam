import assert from "node:assert/strict";
import { lstatSync, realpathSync } from "node:fs";
import { basename, dirname, isAbsolute } from "node:path";
import process from "node:process";
import { DatabaseSync } from "node:sqlite";
import { tmpdir } from "node:os";

import { expectedExportRows } from "./contract-export-db.mjs";

const databasePath = process.env.BODAM_E2E_DB_PATH;
assert.ok(databasePath && isAbsolute(databasePath));
const runtimeDirectory = realpathSync(dirname(databasePath));
assert.equal(dirname(runtimeDirectory), realpathSync(tmpdir()));
assert.match(basename(runtimeDirectory), /^bodam-e2e-.+/);
assert.equal(lstatSync(databasePath).isFile(), true);

const ids = Object.freeze({
  manualCustomer: "00000000-0000-4000-8000-000000000101",
  conflictCustomer: "00000000-0000-4000-8000-000000000102",
  deletedCustomer: "00000000-0000-4000-8000-000000000103",
  manualPolicy: "00000000-0000-4000-8000-000000000201",
  conflictPolicy: "00000000-0000-4000-8000-000000000202",
  deletedPolicy: "00000000-0000-4000-8000-000000000203",
});

const database = new DatabaseSync(databasePath);
try {
  database.exec("PRAGMA foreign_keys = ON");
  const imported = database.prepare(
    `SELECT policy.id AS policy_id, customer.id AS customer_id
     FROM insurance_policy_import_sources AS source
     JOIN insurance_policies AS policy ON policy.id = source.policy_id
     JOIN customers AS customer ON customer.id = policy.customer_id
     WHERE policy.deleted_at IS NULL AND customer.deleted_at IS NULL
     ORDER BY source.contracted_on, customer.name, policy.id`,
  ).all();
  assert.equal(imported.length, 2);

  database.exec("BEGIN IMMEDIATE");
  try {
    database.prepare("UPDATE customers SET is_managed = 0 WHERE id = ?")
      .run(imported[0].customer_id);
    database.prepare("UPDATE insurance_policies SET is_included = 0 WHERE id = ?")
      .run(imported[1].policy_id);
    database.prepare(
      "UPDATE insurance_policy_import_sources SET affiliation = ? WHERE policy_id = ?",
    ).run("합성지점\n단독LF", imported[0].policy_id);
    database.prepare(
      `UPDATE insurance_policy_import_sources
       SET manager = ?, original_recruiter_name = ?
       WHERE policy_id = ?`,
    ).run("가상담당\r단독CR", "가상모집자 _x000D_ 리터럴", imported[1].policy_id);
    insertCustomer(database, ids.manualCustomer, "합성수동고객", null);
    insertPolicy(database, ids.manualPolicy, ids.manualCustomer, {
      insurer: "가상수동보험",
      productName: "합성수동플랜",
      joinedOn: "2026-01-02",
      premium: 11_000,
      maturesOn: "2036-01-02",
      paymentTerm: "10년",
    });
    insertCustomer(database, ids.conflictCustomer, "합성충돌고객", null);
    insertPolicy(database, ids.conflictPolicy, ids.conflictCustomer, {
      insurer: "가상충돌보험",
      productName: "합성현재플랜",
      joinedOn: "2026-03-04",
      premium: 22_000,
      maturesOn: "2036-03-04",
      paymentTerm: "10년",
    });
    insertSource(database, ids.conflictPolicy, [
      "901", "2026-08-07", "합성충돌지점", "가상담당 충돌", "0000901", "장기",
      "가상충돌보험", "합성원본플랜", "SYNTHETIC-CONFLICT-901", "2026-03-04",
      null, "202608", "001", "22000", "합성충돌고객", null, "2026-03-04",
      "2036-03-04", null, "10년", "가상모집자 충돌",
    ]);
    insertCustomer(database, ids.deletedCustomer, "합성삭제고객", "2026-08-07 00:00:00");
    insertPolicy(database, ids.deletedPolicy, ids.deletedCustomer, {
      insurer: "가상삭제보험",
      productName: "합성삭제플랜",
      joinedOn: "2026-05-06",
      premium: 33_000,
      maturesOn: "2036-05-06",
      paymentTerm: "10년",
    });
    insertSource(database, ids.deletedPolicy, [
      "902", "2026-08-07", "합성삭제지점", "가상담당 삭제", "0000902", "장기",
      "가상삭제보험", "합성삭제플랜", "SYNTHETIC-DELETED-902", "2026-05-06",
      null, "202608", "001", "33000", "합성삭제고객", null, "2026-05-06",
      "2036-05-06", null, "10년", "가상모집자 삭제",
    ]);
    database.exec("COMMIT");
  } catch (error) {
    database.exec("ROLLBACK");
    throw error;
  }
  assertFixtureShape(database, imported);
} finally {
  database.close();
}
assert.equal(expectedExportRows(databasePath).length, 2);

function insertCustomer(connection, id, name, deletedAt) {
  connection.prepare(
    "INSERT INTO customers (id, name, is_managed, deleted_at) VALUES (?, ?, 1, ?)",
  ).run(id, name, deletedAt);
}

function insertPolicy(connection, id, customerId, input) {
  connection.prepare(
    `INSERT INTO insurance_policies
       (id, customer_id, insurer, product_name, joined_on, payment_term,
        monthly_premium_won, matures_on, renewable, is_included)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 1)`,
  ).run(
    id, customerId, input.insurer, input.productName, input.joinedOn,
    input.paymentTerm, input.premium, input.maturesOn,
  );
}

function insertSource(connection, policyId, values) {
  assert.equal(values.length, 21);
  connection.prepare(
    `INSERT INTO insurance_policy_import_sources
       (policy_id, no, collection_reflected_on, affiliation, manager, collection_code,
        contract, insurer, product_name, policy_number, contracted_on, status,
        final_payment_month, payment_sequence, payment_premium, contractor, insured,
        coverage_starts_on, coverage_ends_on, collection_method, payment_term,
        original_recruiter_name)
     VALUES (${Array.from({ length: 22 }, () => "?").join(", ")})`,
  ).run(policyId, ...values);
}

function assertFixtureShape(connection, imported) {
  assert.equal(connection.prepare(
    `SELECT COUNT(*) AS count
     FROM insurance_policies AS policy
     JOIN customers AS customer ON customer.id = policy.customer_id
     LEFT JOIN insurance_policy_import_sources AS source ON source.policy_id = policy.id
     WHERE policy.deleted_at IS NULL AND customer.deleted_at IS NULL
       AND source.policy_id IS NULL`,
  ).get().count, 1);
  assert.equal(connection.prepare(
    `SELECT COUNT(*) AS count FROM insurance_policy_import_sources AS source
     JOIN insurance_policies AS policy ON policy.id = source.policy_id
     JOIN customers AS customer ON customer.id = policy.customer_id
     WHERE policy.deleted_at IS NULL AND customer.deleted_at IS NULL`,
  ).get().count, 3);
  assert.equal(connection.prepare(
    `SELECT COUNT(*) AS count FROM insurance_policy_import_sources AS source
     JOIN insurance_policies AS policy ON policy.id = source.policy_id
     JOIN customers AS customer ON customer.id = policy.customer_id
     WHERE customer.deleted_at IS NOT NULL`,
  ).get().count, 1);
  assert.equal(connection.prepare(
    "SELECT is_managed FROM customers WHERE id = ?",
  ).get(imported[0].customer_id).is_managed, 0);
  assert.equal(connection.prepare(
    "SELECT is_included FROM insurance_policies WHERE id = ?",
  ).get(imported[1].policy_id).is_included, 0);
}
