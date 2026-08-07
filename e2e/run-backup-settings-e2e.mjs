import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { spawnSync } from "node:child_process";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runBackupSettingsScenario } from "./backup-settings-runner.mjs";
import { resolveInstalledWindowsE2eBinary } from "./e2e-app-binary.mjs";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const targetDirectory = resolve(projectRoot, "src-tauri", "target", "e2e");
const runtimeDirectory = mkdtempSync(resolve(tmpdir(), "bodam-e2e-backup-"));
const backupDatabasePath = resolve(runtimeDirectory, "backup-settings-e2e.sqlite3");
const backupDirectory = resolve(runtimeDirectory, "synthetic-backups");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const baseEnvironment = {
  ...process.env,
  CARGO_TARGET_DIR: targetDirectory,
};

function runScript(name, environment = process.env, allowFailure = false) {
  const result = spawnSync(npmCommand, ["run", name], {
    cwd: projectRoot,
    env: environment,
    stdio: "inherit",
  });
  if (result.error) throw result.error;
  if (result.status !== 0 && !allowFailure) {
    throw new Error(`${name} failed with status ${result.status ?? result.signal}`);
  }
  return result.status ?? result.signal;
}

function removeRuntimeDirectory() {
  rmSync(runtimeDirectory, {
    recursive: true,
    force: true,
    maxRetries: 20,
    retryDelay: 200,
  });
  if (existsSync(runtimeDirectory)) {
    throw new Error("backup settings E2E temporary directory cleanup failed");
  }
}

try {
  const installedBinary = resolveInstalledWindowsE2eBinary();
  if (!installedBinary) {
    const buildScript = process.platform === "darwin" ? "e2e:build:macos" : "e2e:build";
    runScript(buildScript, baseEnvironment);
  }
  await runBackupSettingsScenario({
    baseEnvironment,
    backupDatabasePath,
    backupDirectory,
    runScript,
    runtimeDirectory,
  });
} finally {
  removeRuntimeDirectory();
}
