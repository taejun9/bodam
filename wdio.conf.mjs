import { isAbsolute, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL(".", import.meta.url));
const databasePath = process.env.BODAM_E2E_DB_PATH;

if (!databasePath || !isAbsolute(databasePath) || !databasePath.endsWith(".sqlite3")) {
  throw new Error("BODAM_E2E_DB_PATH must be an absolute temporary SQLite path");
}

const releaseDirectory = resolve(projectRoot, "src-tauri", "target", "release");
const appBinaryPath = process.platform === "darwin"
  ? resolve(releaseDirectory, "bundle", "macos", "BODAM.app", "Contents", "MacOS", "bodam")
  : resolve(releaseDirectory, process.platform === "win32" ? "bodam.exe" : "bodam");

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
  outputDir: resolve(projectRoot, ".runtime", "wdio-logs"),
  bail: 0,
  waitforTimeout: 10_000,
  connectionRetryTimeout: 120_000,
  connectionRetryCount: 1,
  framework: "jasmine",
  reporters: ["spec"],
  jasmineOpts: {
    defaultTimeoutInterval: 60_000,
  },
};
