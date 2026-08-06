/* global describe, it */

import { basename } from "node:path";

import { $, browser, expect } from "@wdio/globals";

import {
  automaticCount,
  backupCustomers,
  backupEnvironment,
  checkDailyWhenReady,
  createSyntheticCustomer,
  expectDashboardSettings,
  expectPathless,
  expectSettings,
  navigateToSettings,
  saveSettings,
  snapshotSettings,
} from "../backup-settings.fixture.mjs";
import { expectSecondInstanceRejected } from "../single-instance.fixture.mjs";

describe("BODAM native backup settings write phase", () => {
  it("persists settings, selects a custom directory, and creates a pathless manual backup", async () => {
    const { backupDirectory } = backupEnvironment();
    await expectSecondInstanceRejected();
    let { section, status } = await navigateToSettings();
    expect(await status.getText()).toContain("앱 기본 백업 폴더");
    await saveSettings(section, snapshotSettings);

    await $("[data-testid='choose-backup-directory']").click();
    await browser.waitUntil(
      async () => (await status.getText()).includes(basename(backupDirectory)),
      { timeout: 10_000, timeoutMsg: "custom backup directory was not selected" },
    );
    expect(await status.getText()).toContain("사용자 지정");
    await $("button=기본 위치 사용").click();
    await browser.waitUntil(
      async () => (await status.getText()).includes("앱 기본 백업 폴더"),
      { timeout: 10_000, timeoutMsg: "default backup directory was not restored" },
    );
    await $("[data-testid='choose-backup-directory']").click();
    await browser.waitUntil(
      async () => (await status.getText()).includes(basename(backupDirectory)),
      { timeout: 10_000, timeoutMsg: "custom backup directory was not reselected" },
    );
    expectPathless(await status.getText(), basename(backupDirectory));

    await createSyntheticCustomer(backupCustomers.snapshot);
    ({ section, status } = await navigateToSettings());
    await expectSettings(section, snapshotSettings);
    const automaticBeforeManual = automaticCount(await status.getText());

    await $("button=지금 백업").click();
    const result = await $("[data-testid='backup-result']");
    await result.waitForDisplayed({ timeout: 45_000 });
    const resultText = await result.getText();
    const artifact = resultText.match(/BODAM-manual-[^\s]+\.bodam-backup/)?.[0];
    expect(artifact).toBeDefined();
    expect(resultText).toContain("수동 백업");
    expectPathless(resultText, artifact);

    await status.waitForDisplayed({ timeout: 15_000 });
    expect(automaticCount(await status.getText())).toBe(automaticBeforeManual);
    const firstDaily = await checkDailyWhenReady();
    const secondDaily = await checkDailyWhenReady();
    expect(firstDaily.automaticCount).toBeGreaterThanOrEqual(1);
    expect(secondDaily.automaticCount).toBe(firstDaily.automaticCount);
    await expectDashboardSettings(snapshotSettings);
  });
});
