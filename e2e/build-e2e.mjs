import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (!new Set(["macos", "no-bundle", "windows-nsis"]).has(mode)) {
  throw new Error("BODAM E2E build mode is invalid");
}
if (mode === "macos" && process.platform !== "darwin") {
  throw new Error("BODAM E2E macOS bundle mode requires macOS");
}
if (mode === "windows-nsis" && process.platform !== "win32") {
  throw new Error("BODAM E2E NSIS mode requires Windows");
}

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const tauriBinary = resolve(
  projectRoot,
  "node_modules",
  ".bin",
  process.platform === "win32" ? "tauri.cmd" : "tauri",
);
if (!existsSync(tauriBinary)) throw new Error("BODAM E2E Tauri CLI is unavailable");

const args = [
  "build",
  "--config",
  resolve(projectRoot, "src-tauri", "tauri.e2e.conf.json"),
  ...(mode === "macos"
    ? ["--bundles", "app"]
    : mode === "windows-nsis"
      ? ["--ci", "--no-sign", "--bundles", "nsis"]
      : ["--no-bundle"]),
  "--features",
  "e2e",
];
const result = spawnSync(tauriBinary, args, {
  cwd: projectRoot,
  env: {
    ...process.env,
    CARGO_TARGET_DIR: resolve(projectRoot, "src-tauri", "target", "e2e"),
  },
  stdio: "inherit",
});
if (result.error) throw result.error;
if (result.status !== 0) {
  throw new Error(`BODAM E2E build failed with status ${result.status ?? result.signal}`);
}
