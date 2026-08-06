/* global describe, it */

import { basename } from "node:path";

import { $, expect } from "@wdio/globals";

import {
  backupCustomers,
  backupEnvironment,
  expectPathless,
  expectSessionEnd,
  expectSettings,
  expectSyntheticCustomer,
  mutatedSettings,
  navigateToSettings,
} from "../backup-settings.fixture.mjs";

describe("BODAM native backup restore request phase", () => {
  it("previews a pathless archive and cleanly ends the phased restart session", async () => {
    const { restoreFile } = backupEnvironment({ restoreRequired: true });
    const { section } = await navigateToSettings();
    await expectSettings(section, mutatedSettings);
    await expectSyntheticCustomer(backupCustomers.snapshot.name, true);
    await expectSyntheticCustomer(backupCustomers.mutation.name, true);
    await navigateToSettings();

    await $("[data-testid='choose-restore']").click();
    const dialog = await $("dialog[open]");
    await dialog.waitForDisplayed({ timeout: 20_000 });
    const previewText = await dialog.getText();
    expect(previewText).toContain("수동 백업");
    expectPathless(previewText, basename(restoreFile));
    const confirm = await dialog.$("button=복원하고 다시 시작");
    await expectSessionEnd(() => confirm.click());
  });
});
