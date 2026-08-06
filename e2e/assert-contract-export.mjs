import assert from "node:assert/strict";
import process from "node:process";

import { assertCsvExport } from "./contract-export-csv.mjs";
import {
  assertLogicalSnapshot,
  assertRegularExport,
  expectedExportRows,
  exportAssertionEnvironment,
  writeLogicalSnapshot,
} from "./contract-export-db.mjs";
import { assertXlsxExport } from "./contract-export-xlsx.mjs";

const mode = process.env.BODAM_E2E_EXPORT_ASSERT_MODE;
const environment = exportAssertionEnvironment();

if (mode === "snapshot") {
  writeLogicalSnapshot(environment.databasePath, environment.snapshotPath);
} else {
  assert.equal(mode, environment.format);
  assertRegularExport(environment.exportPath);
  const expectedRows = expectedExportRows(environment.databasePath);
  assert.equal(expectedRows.length, 2, "synthetic export row count");
  if (environment.format === "xlsx") {
    assertXlsxExport(environment.exportPath, expectedRows);
  } else {
    assertCsvExport(environment.exportPath, expectedRows);
  }
  assertLogicalSnapshot(environment.databasePath, environment.snapshotPath);
}
