import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const runtimeDirectory = mkdtempSync(resolve(tmpdir(), "bodam-e2e-"));
const databasePath = resolve(runtimeDirectory, "bodam-e2e.sqlite3");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function cleanDatabase() {
  for (const suffix of ["", "-journal", "-shm", "-wal"]) {
    rmSync(`${databasePath}${suffix}`, { force: true });
  }
}

function removeRuntimeDirectory() {
  try {
    cleanDatabase();
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

cleanDatabase();

try {
  const buildScript = process.platform === "darwin" ? "e2e:build:macos" : "e2e:build";
  runScript(buildScript);
  const e2eEnvironment = {
    ...process.env,
    BODAM_E2E_DB_PATH: databasePath,
  };
  runScript("e2e:write", e2eEnvironment);
  runScript("e2e:persistence", e2eEnvironment);
} finally {
  removeRuntimeDirectory();
}
