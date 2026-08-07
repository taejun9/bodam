import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runBackupSettingsScenario } from "./backup-settings-runner.mjs";
import { resolveInstalledWindowsE2eBinary } from "./e2e-app-binary.mjs";
import { createNpmScriptRunner } from "./node-script-runner.mjs";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const runScript = createNpmScriptRunner({ projectRoot });
const e2eTargetDirectory = resolve(projectRoot, "src-tauri", "target", "e2e");
const baseEnvironment = {
  ...process.env,
  CARGO_TARGET_DIR: e2eTargetDirectory,
};
const runtimeDirectory = mkdtempSync(resolve(tmpdir(), "bodam-e2e-"));
const customerDatabasePath = resolve(runtimeDirectory, "bodam-e2e.sqlite3");
const dataExchangeDatabasePath = resolve(runtimeDirectory, "data-exchange-e2e.sqlite3");
const csvDatabasePath = resolve(runtimeDirectory, "data-exchange-csv-e2e.sqlite3");
const rollbackDatabasePath = resolve(runtimeDirectory, "data-exchange-rollback-e2e.sqlite3");
const backupSettingsDatabasePath = resolve(runtimeDirectory, "backup-settings-e2e.sqlite3");
const backupDirectory = resolve(runtimeDirectory, "synthetic-backups");
const xlsxExportPath = resolve(runtimeDirectory, "synthetic-contracts-export.xlsx");
const csvExportPath = resolve(runtimeDirectory, "synthetic-contracts-export.csv");
const xlsxExportSnapshotPath = resolve(runtimeDirectory, "synthetic-export-xlsx.json");
const csvExportSnapshotPath = resolve(runtimeDirectory, "synthetic-export-csv.json");
const sourceXlsxFixture = resolve(
  projectRoot,
  "tests",
  "fixtures",
  "synthetic",
  "synthetic-contracts-valid.xlsx",
);
const sourceCsvFixture = resolve(
  projectRoot,
  "tests",
  "fixtures",
  "synthetic",
  "synthetic-contracts-valid.csv",
);
const runtimeXlsxFixture = resolve(runtimeDirectory, "synthetic-contracts-valid.xlsx");
const runtimeCsvFixture = resolve(runtimeDirectory, "synthetic-contracts-valid.csv");
const databasePaths = [
  customerDatabasePath,
  dataExchangeDatabasePath,
  csvDatabasePath,
  rollbackDatabasePath,
  backupSettingsDatabasePath,
];
const generatedPaths = [
  xlsxExportPath,
  csvExportPath,
  xlsxExportSnapshotPath,
  csvExportSnapshotPath,
];

function cleanDatabase(databasePath) {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function removeRuntimeDirectory() {
  try {
    databasePaths.forEach(cleanDatabase);
    rmSync(runtimeXlsxFixture, { force: true });
    rmSync(runtimeCsvFixture, { force: true });
    generatedPaths.forEach((path) => rmSync(path, { force: true }));
  } catch {
    // Recursive removal below retries locked Windows handles and remains authoritative.
  }
  rmSync(runtimeDirectory, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 200,
  });
  if (existsSync(runtimeDirectory)) {
    throw new Error("BODAM E2E temporary directory cleanup failed");
  }
}

function fileDigest(path) {
  return createHash("sha256").update(readFileSync(path)).digest("hex");
}

function assertFileUnchanged(path, expectedDigest) {
  if (fileDigest(path) !== expectedDigest) {
    throw new Error("synthetic contract fixture changed during E2E");
  }
}

function runContractExport(format, environment, exportPath, snapshotPath) {
  const exportEnvironment = {
    ...environment,
    BODAM_E2E_EXPORT_FORMAT: format,
    BODAM_E2E_EXPORT_PATH: exportPath,
    BODAM_E2E_EXPORT_SNAPSHOT_PATH: snapshotPath,
  };
  runScript("e2e:data-exchange-export-prepare", exportEnvironment);
  runScript("e2e:data-exchange-export-assert", {
    ...exportEnvironment,
    BODAM_E2E_EXPORT_ASSERT_MODE: "snapshot",
  });
  runScript("e2e:data-exchange-export", exportEnvironment);
  runScript("e2e:data-exchange-export-assert", {
    ...exportEnvironment,
    BODAM_E2E_EXPORT_ASSERT_MODE: format,
  });
  runScript("e2e:data-exchange-export-roundtrip", {
    ...exportEnvironment,
    BODAM_E2E_IMPORT_PATH: exportPath,
  });
  runScript("e2e:data-exchange-export-assert", {
    ...exportEnvironment,
    BODAM_E2E_EXPORT_ASSERT_MODE: format,
  });
}

try {
  if (!existsSync(sourceXlsxFixture) || !existsSync(sourceCsvFixture)) {
    throw new Error("synthetic contract import fixtures are unavailable");
  }
  databasePaths.forEach(cleanDatabase);
  rmSync(runtimeXlsxFixture, { force: true });
  rmSync(runtimeCsvFixture, { force: true });
  generatedPaths.forEach((path) => rmSync(path, { force: true }));
  copyFileSync(sourceXlsxFixture, runtimeXlsxFixture);
  copyFileSync(sourceCsvFixture, runtimeCsvFixture);
  const xlsxDigest = fileDigest(runtimeXlsxFixture);
  const csvDigest = fileDigest(runtimeCsvFixture);
  const installedBinary = resolveInstalledWindowsE2eBinary();
  if (!installedBinary) {
    const buildScript = process.platform === "darwin" ? "e2e:build:macos" : "e2e:build";
    runScript(buildScript, baseEnvironment);
  }
  const customerEnvironment = {
    ...baseEnvironment,
    BODAM_E2E_DB_PATH: customerDatabasePath,
  };
  runScript("e2e:write", customerEnvironment);
  runScript("e2e:persistence", customerEnvironment);
  const dataExchangeEnvironment = {
    ...baseEnvironment,
    BODAM_E2E_DB_PATH: dataExchangeDatabasePath,
    BODAM_E2E_IMPORT_PATH: runtimeXlsxFixture,
  };
  runScript("e2e:data-exchange-write", dataExchangeEnvironment);
  runScript("e2e:data-exchange-db-assert", {
    ...dataExchangeEnvironment,
    BODAM_E2E_ASSERT_MODE: "xlsx",
  });
  runScript("e2e:data-exchange-persistence", dataExchangeEnvironment);
  runContractExport(
    "xlsx",
    dataExchangeEnvironment,
    xlsxExportPath,
    xlsxExportSnapshotPath,
  );
  assertFileUnchanged(runtimeXlsxFixture, xlsxDigest);

  const csvEnvironment = {
    ...baseEnvironment,
    BODAM_E2E_DB_PATH: csvDatabasePath,
    BODAM_E2E_IMPORT_PATH: runtimeCsvFixture,
  };
  runScript("e2e:data-exchange-csv-write", csvEnvironment);
  runScript("e2e:data-exchange-db-assert", {
    ...csvEnvironment,
    BODAM_E2E_ASSERT_MODE: "csv",
  });
  runScript("e2e:data-exchange-csv-persistence", csvEnvironment);
  runContractExport("csv", csvEnvironment, csvExportPath, csvExportSnapshotPath);
  assertFileUnchanged(runtimeCsvFixture, csvDigest);

  const rollbackEnvironment = {
    ...baseEnvironment,
    BODAM_E2E_DB_PATH: rollbackDatabasePath,
    BODAM_E2E_IMPORT_PATH: runtimeXlsxFixture,
    BODAM_E2E_IMPORT_FAIL_SOURCE_ROW: "4",
  };
  runScript("e2e:data-exchange-rollback", rollbackEnvironment);
  runScript("e2e:data-exchange-db-assert", {
    ...rollbackEnvironment,
    BODAM_E2E_ASSERT_MODE: "empty",
  });
  assertFileUnchanged(runtimeXlsxFixture, xlsxDigest);

  await runBackupSettingsScenario({
    baseEnvironment,
    backupDatabasePath: backupSettingsDatabasePath,
    backupDirectory,
    runScript,
    runtimeDirectory,
  });
} finally {
  removeRuntimeDirectory();
}
