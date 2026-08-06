import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { $, browser, expect } from "@wdio/globals";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const expectedTarget = resolve(projectRoot, "src-tauri", "target", "e2e");

export async function expectSecondInstanceRejected() {
  const target = process.env.CARGO_TARGET_DIR;
  const database = process.env.BODAM_E2E_DB_PATH;
  if (!target || !isAbsolute(target) || resolve(target) !== expectedTarget ||
      !database || !isAbsolute(database)) {
    throw new Error("single-instance E2E paths are invalid");
  }
  const release = resolve(target, "release");
  const binary = process.platform === "darwin"
    ? resolve(release, "bundle", "macos", "BODAM E2E.app", "Contents", "MacOS", "bodam")
    : resolve(release, process.platform === "win32" ? "bodam.exe" : "bodam");
  if (!existsSync(binary)) throw new Error("single-instance E2E binary is unavailable");

  const second = spawnSync(binary, ["--synthetic-second-instance"], {
    cwd: dirname(database),
    env: process.env,
    stdio: "ignore",
    timeout: 15_000,
  });
  if (second.error) throw second.error;
  expect(second.signal).toBeNull();
  expect(second.status).toBe(0);

  await browser.getTitle();
  await expect($("a[href='#/settings']")).toBeDisplayed();
}
