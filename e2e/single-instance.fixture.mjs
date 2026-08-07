import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { dirname, isAbsolute, resolve } from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { $, browser, expect } from "@wdio/globals";

import { resolveE2eAppBinary } from "./e2e-app-binary.mjs";

const projectRoot = fileURLToPath(new globalThis.URL("..", import.meta.url));
const expectedTarget = resolve(projectRoot, "src-tauri", "target", "e2e");

export async function expectSecondInstanceRejected() {
  const target = process.env.CARGO_TARGET_DIR;
  const database = process.env.BODAM_E2E_DB_PATH;
  if (!target || !isAbsolute(target) || resolve(target) !== expectedTarget ||
      !database || !isAbsolute(database)) {
    throw new Error("single-instance E2E paths are invalid");
  }
  const binary = resolveE2eAppBinary(expectedTarget);
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
