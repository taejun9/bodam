import { createHash } from "node:crypto";
import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const runtimeDirectory = mkdtempSync(resolve(tmpdir(), "bodam-e2e-"));
const customerDatabasePath = resolve(runtimeDirectory, "bodam-e2e.sqlite3");
const dataExchangeDatabasePath = resolve(runtimeDirectory, "data-exchange-e2e.sqlite3");
const csvDatabasePath = resolve(runtimeDirectory, "data-exchange-csv-e2e.sqlite3");
const rollbackDatabasePath = resolve(runtimeDirectory, "data-exchange-rollback-e2e.sqlite3");
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
];
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

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

function runScript(name, environment = process.env) {
  const result = spawnSync(npmCommand, ["run", name], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${name} failed with status ${result.status ?? result.signal}`);
  }
}

try {
  if (!existsSync(sourceXlsxFixture) || !existsSync(sourceCsvFixture)) {
    throw new Error("synthetic contract import fixtures are unavailable");
  }
  databasePaths.forEach(cleanDatabase);
  rmSync(runtimeXlsxFixture, { force: true });
  rmSync(runtimeCsvFixture, { force: true });
  copyFileSync(sourceXlsxFixture, runtimeXlsxFixture);
  copyFileSync(sourceCsvFixture, runtimeCsvFixture);
  const xlsxDigest = fileDigest(runtimeXlsxFixture);
  const csvDigest = fileDigest(runtimeCsvFixture);
  const buildScript = process.platform === "darwin" ? "e2e:build:macos" : "e2e:build";
  runScript(buildScript);
  const customerEnvironment = {
    ...process.env,
    BODAM_E2E_DB_PATH: customerDatabasePath,
  };
  runScript("e2e:write", customerEnvironment);
  runScript("e2e:persistence", customerEnvironment);
  const dataExchangeEnvironment = {
    ...process.env,
    BODAM_E2E_DB_PATH: dataExchangeDatabasePath,
    BODAM_E2E_IMPORT_PATH: runtimeXlsxFixture,
  };
  runScript("e2e:data-exchange-write", dataExchangeEnvironment);
  runScript("e2e:data-exchange-db-assert", {
    ...dataExchangeEnvironment,
    BODAM_E2E_ASSERT_MODE: "xlsx",
  });
  runScript("e2e:data-exchange-persistence", dataExchangeEnvironment);
  assertFileUnchanged(runtimeXlsxFixture, xlsxDigest);

  const csvEnvironment = {
    ...process.env,
    BODAM_E2E_DB_PATH: csvDatabasePath,
    BODAM_E2E_IMPORT_PATH: runtimeCsvFixture,
  };
  runScript("e2e:data-exchange-csv-write", csvEnvironment);
  runScript("e2e:data-exchange-db-assert", {
    ...csvEnvironment,
    BODAM_E2E_ASSERT_MODE: "csv",
  });
  runScript("e2e:data-exchange-csv-persistence", csvEnvironment);
  assertFileUnchanged(runtimeCsvFixture, csvDigest);

  const rollbackEnvironment = {
    ...process.env,
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
} finally {
  removeRuntimeDirectory();
}
