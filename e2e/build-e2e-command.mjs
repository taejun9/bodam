import { isAbsolute, resolve } from "node:path";
import process from "node:process";

const buildModes = new Set(["macos", "no-bundle", "windows-nsis"]);

export function createE2eBuildInvocation(mode, {
  platform = process.platform,
  projectRoot,
  env = process.env,
} = {}) {
  if (!buildModes.has(mode)) throw new Error("BODAM E2E build mode is invalid");
  if (typeof projectRoot !== "string" || projectRoot.includes("\0") ||
      !isAbsolute(projectRoot)) {
    throw new Error("BODAM E2E project root is invalid");
  }
  if (!env || typeof env !== "object" || Array.isArray(env)) {
    throw new Error("BODAM E2E build environment is invalid");
  }
  if (mode === "macos" && platform !== "darwin") {
    throw new Error("BODAM E2E macOS bundle mode requires macOS");
  }
  if (mode === "windows-nsis" && platform !== "win32") {
    throw new Error("BODAM E2E NSIS mode requires Windows");
  }
  const bundleArguments = mode === "macos"
    ? ["--bundles", "app"]
    : mode === "windows-nsis"
      ? ["--ci", "--no-sign", "--bundles", "nsis"]
      : ["--no-bundle"];
  return {
    entrypoint: resolve(projectRoot, "node_modules", "@tauri-apps", "cli", "tauri.js"),
    args: [
      "build",
      "--config",
      resolve(projectRoot, "src-tauri", "tauri.e2e.conf.json"),
      ...bundleArguments,
      "--features",
      "e2e",
    ],
    cwd: projectRoot,
    env: {
      ...env,
      CARGO_TARGET_DIR: resolve(projectRoot, "src-tauri", "target", "e2e"),
    },
  };
}
