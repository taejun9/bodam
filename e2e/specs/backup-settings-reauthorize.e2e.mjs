/* global describe, it */

import { basename } from "node:path";

import { $, browser } from "@wdio/globals";

import {
  backupEnvironment,
  checkDailyWhenReady,
  expectPathless,
  expectSettings,
  navigateToSettings,
  snapshotSettings,
} from "../backup-settings.fixture.mjs";

describe("BODAM native backup directory re-authorization phase", () => {
  it("re-authorizes the host-local directory after exact restored database comparison", async () => {
    const { backupDirectory } = backupEnvironment();
    const { section, status } = await navigateToSettings();
    await expectSettings(section, snapshotSettings);
    await $("[data-testid='choose-backup-directory']").click();
    await browser.waitUntil(
      async () => (await status.getText()).includes(basename(backupDirectory)),
      { timeout: 10_000, timeoutMsg: "restored backup directory was not re-authorized" },
    );
    expectPathless(await status.getText(), basename(backupDirectory));

    const firstDaily = await checkDailyWhenReady();
    const secondDaily = await checkDailyWhenReady();
    if (secondDaily.automaticCount !== firstDaily.automaticCount) {
      throw new Error("re-authorized daily backup was not idempotent");
    }
  });
});
