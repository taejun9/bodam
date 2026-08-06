/* global describe, it */

import { basename } from "node:path";

import { $, browser, expect } from "@wdio/globals";

import {
  backupCustomers,
  backupEnvironment,
  expectDashboardSettings,
  expectPathless,
  expectSettings,
  expectSyntheticCustomer,
  invokeBackup,
  navigateToSettings,
  snapshotSettings,
  waitForNativeShell,
} from "../backup-settings.fixture.mjs";

describe("BODAM native backup restore verification phase", () => {
  it("applies pending restore before open and reports the safe startup result once", async () => {
    const { backupDirectory, restoreFile } = backupEnvironment({ restoreRequired: true });
    await waitForNativeShell();
    const startupNotice = await $(".backup-lifecycle-notice");
    await startupNotice.waitForDisplayed({ timeout: 20_000 });
    const startupText = await startupNotice.getText();
    expect(startupText).toContain("복원");
    expectPathless(startupText);

    const { section, status } = await navigateToSettings();
    await expectSettings(section, snapshotSettings);
    const restoredStatusText = await status.getText();
    expect(restoredStatusText).toContain("앱 기본 백업 폴더");
    expect(restoredStatusText).not.toContain(basename(backupDirectory));
    expectPathless(restoredStatusText);
    expect(restoredStatusText).not.toContain(restoreFile);
    await browser.waitUntil(async () => {
      try {
        return (await invokeBackup("load_backup_status")).restoreStartup === null;
      } catch {
        return false;
      }
    }, {
      timeout: 15_000,
      timeoutMsg: "restore startup status was not acknowledged after rendering",
    });

    await expectSyntheticCustomer(backupCustomers.snapshot.name, true);
    await expectSyntheticCustomer(backupCustomers.mutation.name, false);
    await expectDashboardSettings(snapshotSettings);
  });
});
