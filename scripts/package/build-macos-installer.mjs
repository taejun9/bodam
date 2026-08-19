import { spawnSync } from "node:child_process";
import { dirname, delimiter, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new globalThis.URL("../..", import.meta.url));

function fail(message) {
  throw new Error(`BODAM macOS installer build failed: ${message}`);
}

function rustup(args) {
  const result = spawnSync("rustup", args, {
    cwd: projectRoot,
    encoding: "utf8",
    env: process.env,
    shell: false,
  });
  if (result.error || result.status !== 0) fail("a stable rustup toolchain is required");
  return result.stdout.trim();
}

if (process.platform !== "darwin") fail("this command must run on macOS");

const installedTargets = new Set(
  rustup(["target", "list", "--installed", "--toolchain", "stable"]).split(/\s+/),
);
for (const target of ["aarch64-apple-darwin", "x86_64-apple-darwin"]) {
  if (!installedTargets.has(target)) {
    fail(`missing ${target}; run rustup target add ${target} --toolchain stable`);
  }
}

const cargo = rustup(["which", "cargo", "--toolchain", "stable"]);
const rustc = rustup(["which", "rustc", "--toolchain", "stable"]);
const rustdoc = rustup(["which", "rustdoc", "--toolchain", "stable"]);
const tauri = resolve(projectRoot, "node_modules/@tauri-apps/cli/tauri.js");
const toolchainPath = `${dirname(cargo)}${delimiter}${process.env.PATH ?? ""}`;
const result = spawnSync(
  process.execPath,
  [
    tauri,
    "build",
    "--ci",
    "--bundles",
    "dmg",
    "--target",
    "universal-apple-darwin",
    "--runner",
    cargo,
  ],
  {
    cwd: projectRoot,
    env: {
      ...process.env,
      CARGO: cargo,
      CI: "true",
      RUSTC: rustc,
      RUSTDOC: rustdoc,
      PATH: toolchainPath,
    },
    stdio: "inherit",
    shell: false,
  },
);
if (result.error || result.status !== 0) fail("Tauri returned a non-zero status");
