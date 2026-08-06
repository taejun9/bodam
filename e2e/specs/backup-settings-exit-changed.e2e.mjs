/* global describe, it */

import { writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import { expect } from "@wdio/globals";

import {
  backupCustomers,
  backupEnvironment,
  checkDailyWhenReady,
  closeNativeWindow,
  createSyntheticCustomer,
  expectSessionEnd,
  waitForNativeShell,
} from "../backup-settings.fixture.mjs";

describe("BODAM native changed exit backup phase", () => {
  it("creates a changed-only exit backup after the last daily check", async () => {
    const { databasePath } = backupEnvironment();
    const markerPath = process.env.BODAM_E2E_PHASE_MARKER;
    if (!markerPath || !isAbsolute(markerPath) ||
        dirname(markerPath) !== dirname(databasePath) || !markerPath.endsWith(".json")) {
      throw new Error("backup E2E phase marker must be in the temporary runtime root");
    }
    await waitForNativeShell();
    const firstDaily = await checkDailyWhenReady();
    const secondDaily = await checkDailyWhenReady();
    expect(secondDaily.automaticCount).toBe(firstDaily.automaticCount);
    await createSyntheticCustomer(backupCustomers.exitChanged);
    await expectSessionEnd(() => closeNativeWindow());
    writeFileSync(markerPath, JSON.stringify({
      dailyCount: secondDaily.automaticCount,
      changedAfterDaily: true,
    }));
  });
});
