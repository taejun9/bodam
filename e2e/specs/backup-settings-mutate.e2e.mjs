/* global describe, it */

import { basename } from "node:path";

import { expect } from "@wdio/globals";

import {
  backupCustomers,
  backupEnvironment,
  checkDailyWhenReady,
  createSyntheticCustomer,
  expectDashboardSettings,
  expectPathless,
  expectSettings,
  expectSyntheticCustomer,
  mutatedSettings,
  navigateToSettings,
  saveSettings,
  snapshotSettings,
} from "../backup-settings.fixture.mjs";

describe("BODAM native backup settings mutation phase", () => {
  it("loads persisted settings, then creates a synthetic post-backup state", async () => {
    const { backupDirectory } = backupEnvironment();
    let { section, status } = await navigateToSettings();
    await expectSettings(section, snapshotSettings);
    expectPathless(await status.getText(), basename(backupDirectory));
    await expectDashboardSettings(snapshotSettings);

    ({ section, status } = await navigateToSettings());
    await saveSettings(section, mutatedSettings);
    expect(await status.getText()).toContain("사용자 지정");
    await expectSyntheticCustomer(backupCustomers.snapshot.name, true);
    await createSyntheticCustomer(backupCustomers.mutation);
    await expectDashboardSettings(mutatedSettings);

    ({ section } = await navigateToSettings());
    await expectSettings(section, mutatedSettings);
    const firstDaily = await checkDailyWhenReady();
    const secondDaily = await checkDailyWhenReady();
    expect(secondDaily.automaticCount).toBe(firstDaily.automaticCount);
  });
});
