import { existsSync, realpathSync, statSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { resolveE2eAppBinary } from "./e2e/e2e-app-binary.mjs";

const projectRoot = fileURLToPath(new globalThis.URL(".", import.meta.url));
const databasePath = process.env.BODAM_E2E_DB_PATH;

if (!databasePath || !isAbsolute(databasePath) || !databasePath.endsWith(".sqlite3")) {
  throw new Error("BODAM_E2E_DB_PATH must be an absolute temporary SQLite path");
}
const runtimeDirectory = realpathSync(dirname(databasePath));
if (!basename(runtimeDirectory).startsWith("bodam-e2e-")) {
  throw new Error("BODAM_E2E_DB_PATH must use the isolated BODAM E2E runtime prefix");
}

function containedRuntimePath(path, { mustExist = true } = {}) {
  if (!path || !isAbsolute(path)) return false;
  const candidate = mustExist
    ? realpathSync(path)
    : resolve(realpathSync(dirname(path)), basename(path));
  const child = relative(runtimeDirectory, candidate);
  return child !== "" && child !== ".." &&
    !child.startsWith("../") && !child.startsWith("..\\") && !isAbsolute(child);
}

const backupDirectory = process.env.BODAM_E2E_BACKUP_DIRECTORY;
if (backupDirectory && (
  !existsSync(backupDirectory) || !containedRuntimePath(backupDirectory) ||
  !statSync(backupDirectory).isDirectory()
)) {
  throw new Error("BODAM_E2E_BACKUP_DIRECTORY must be an existing temporary directory");
}
const restoreFile = process.env.BODAM_E2E_RESTORE_FILE;
if (restoreFile && (
  !backupDirectory || !restoreFile.endsWith(".bodam-backup") ||
  !existsSync(restoreFile) || !containedRuntimePath(restoreFile) ||
  !statSync(restoreFile).isFile() ||
  dirname(realpathSync(restoreFile)) !== realpathSync(backupDirectory)
)) {
  throw new Error("BODAM_E2E_RESTORE_FILE must be an archive in the temporary backup directory");
}
const phaseMarker = process.env.BODAM_E2E_PHASE_MARKER;
if (phaseMarker && (!containedRuntimePath(phaseMarker, { mustExist: false }) ||
    realpathSync(dirname(phaseMarker)) !== runtimeDirectory ||
    !phaseMarker.endsWith(".json"))) {
  throw new Error("BODAM_E2E_PHASE_MARKER must be a temporary runtime JSON path");
}
const phasedRestart = process.env.BODAM_E2E_PHASED_RESTART;
if (phasedRestart && (phasedRestart !== "1" || !restoreFile)) {
  throw new Error("BODAM_E2E_PHASED_RESTART requires the isolated restore archive");
}

const targetDirectory = resolve(projectRoot, "src-tauri", "target", "e2e");
const configuredTargetDirectory = process.env.CARGO_TARGET_DIR;
if (configuredTargetDirectory && (
  !isAbsolute(configuredTargetDirectory) ||
  resolve(configuredTargetDirectory) !== targetDirectory
)) {
  throw new Error("CARGO_TARGET_DIR must be the isolated BODAM E2E target");
}
const appBinaryPath = resolveE2eAppBinary(targetDirectory);

export const config = {
  runner: "local",
  specs: ["./e2e/specs/*.e2e.mjs"],
  maxInstances: 1,
  services: [
    [
      "@wdio/tauri-service",
      {
        appBinaryPath,
        driverProvider: "embedded",
        embeddedPort: 4445,
        captureBackendLogs: true,
        captureFrontendLogs: false,
        backendLogLevel: "debug",
      },
    ],
  ],
  capabilities: [
    {
      browserName: "tauri",
      "tauri:options": { application: appBinaryPath },
    },
  ],
  logLevel: "warn",
  outputDir: resolve(dirname(databasePath), "wdio-logs"),
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: "jasmine",
  reporters: ["spec"],
  jasmineOpts: {
    defaultTimeoutInterval: 180_000,
  },
};
