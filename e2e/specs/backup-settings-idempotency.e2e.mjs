/* global describe, it */

import { writeFileSync } from "node:fs";
import { dirname, isAbsolute } from "node:path";
import process from "node:process";

import { expect } from "@wdio/globals";

import {
  backupEnvironment,
  checkDailyWhenReady,
  closeNativeWindow,
  expectSessionEnd,
  waitForNativeShell,
} from "../backup-settings.fixture.mjs";

describe("BODAM native automatic backup idempotency phase", () => {
  it("keeps daily idempotent and exits only after changed-only backup evaluation", async () => {
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
    await expectSessionEnd(() => closeNativeWindow());
    writeFileSync(markerPath, JSON.stringify({ dailyCount: secondDaily.automaticCount }));
  });
});
