/* global describe, it */

import { basename, dirname } from "node:path";
import process from "node:process";

import { $, expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import { navigateToDataExchange } from "../data-exchange.fixture.mjs";

describe("BODAM native contract export flow", () => {
  it("saves the eligible source-backed contracts without changing the database", async () => {
    const format = process.env.BODAM_E2E_EXPORT_FORMAT;
    const exportPath = process.env.BODAM_E2E_EXPORT_PATH;
    if (!new Set(["xlsx", "csv"]).has(format) || !exportPath) {
      throw new Error("contract export E2E environment is invalid");
    }
    await waitForNativeApp();
    await navigateToDataExchange();
    const button = await $(`[data-testid='export-${format}']`);
    await button.waitForEnabled({ timeout: 10_000 });
    expect(await button.isEnabled()).toBe(true);
    await button.click();

    const result = await $("[data-testid='export-result']");
    await result.waitForDisplayed({ timeout: 20_000 });
    expect(await result.$("[data-export-count='exported'] dd").getText()).toBe("2");
    expect(await result.$("[data-export-count='missingSource'] dd").getText()).toBe("1");
    expect(await result.$("[data-export-count='sourceConflict'] dd").getText()).toBe("1");
    const resultText = await result.getText();
    expect(resultText).toContain(basename(exportPath));
    expect(resultText).not.toContain(dirname(exportPath));
  });
});
