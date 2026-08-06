/* global describe, it */

import { existsSync, renameSync, writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import { $, browser, expect } from "@wdio/globals";

import {
  backupCustomers,
  backupEnvironment,
  checkDailyWhenReady,
  closeNativeWindow,
  createSyntheticCustomer,
  expectPathless,
  expectSessionEnd,
  waitForNativeShell,
} from "../backup-settings.fixture.mjs";

describe("BODAM native exit backup failure phase", () => {
  it("shows the real failure dialog, keeps retry safe, and permits warned exit", async () => {
    const { backupDirectory, databasePath } = backupEnvironment();
    const markerPath = requireMarkerPath(databasePath);
    const unavailableDirectory = `${backupDirectory}-unavailable`;
    if (existsSync(unavailableDirectory)) {
      throw new Error("synthetic unavailable backup directory already exists");
    }
    await waitForNativeShell();
    const firstDaily = await checkDailyWhenReady();
    const secondDaily = await checkDailyWhenReady();
    expect(secondDaily.automaticCount).toBe(firstDaily.automaticCount);
    await createSyntheticCustomer(backupCustomers.exitFailure);

    let moved = false;
    try {
      renameSync(backupDirectory, unavailableDirectory);
      moved = true;
      await closeNativeWindow();
      const dialog = await $("dialog[open]");
      await dialog.waitForDisplayed({ timeout: 20_000 });
      const text = await dialog.getText();
      expect(text).toContain("종료 전 백업을 만들지 못했습니다");
      expect(text).toContain("현재 데이터는 그대로입니다");
      expect(text).toContain("백업 없이 종료");
      expectPathless(text);

      const retry = await dialog.$("button=백업 다시 시도");
      const focused = await browser.execute(
        () => globalThis.document.activeElement?.textContent?.trim() ?? "",
      );
      expect(focused).toContain("백업 다시 시도");
      await retry.click();
      const alert = await dialog.$("[role='alert']");
      await alert.waitForDisplayed({ timeout: 20_000 });
      expect(await alert.getText()).toContain("백업");
      expectPathless(await alert.getText());
      const exitWithoutBackup = await dialog.$("button=백업 없이 종료");
      await expectSessionEnd(() => exitWithoutBackup.click());
    } finally {
      if (moved && existsSync(unavailableDirectory)) {
        try { renameSync(unavailableDirectory, backupDirectory); } catch {
          // The runner restores after the terminated app and WDIO worker release Windows locks.
        }
      }
    }
    writeFileSync(markerPath, JSON.stringify({
      dailyCount: secondDaily.automaticCount,
      failureDialog: true,
      retryFailed: true,
      warnedExit: true,
    }));
  });
});

function requireMarkerPath(databasePath) {
  const markerPath = process.env.BODAM_E2E_PHASE_MARKER;
  if (!markerPath || !isAbsolute(markerPath) ||
      dirname(markerPath) !== dirname(databasePath) || !markerPath.endsWith(".json")) {
    throw new Error("backup E2E phase marker must be in the temporary runtime root");
  }
  return markerPath;
}
