/* global describe, it */

import { basename } from "node:path";
import process from "node:process";

import { expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  expectDefaultSkip,
  navigateToDataExchange,
  previewSummary,
  selectSyntheticContractFile,
  sourceDetailValues,
} from "../data-exchange.fixture.mjs";

describe("BODAM exported contract round-trip", () => {
  it("opens the generated 21-column file with the production import parser", async () => {
    const format = process.env.BODAM_E2E_EXPORT_FORMAT;
    const importPath = process.env.BODAM_E2E_IMPORT_PATH;
    if (!new Set(["xlsx", "csv"]).has(format) || !importPath) {
      throw new Error("contract export round-trip environment is invalid");
    }
    await waitForNativeApp();
    await navigateToDataExchange();
    await selectSyntheticContractFile(basename(importPath), 2);
    expect(await previewSummary("전체")).toBe("2");
    expect(await previewSummary("유효")).toBe("2");
    expect(await previewSummary("중복 후보")).toBe("2");
    await expectDefaultSkip(2);
    await expectDefaultSkip(3);
    const firstSource = await sourceDetailValues(2);
    expect(firstSource.No).toBe(format === "xlsx" ? "3" : "1");
    expect(firstSource["수금인코드"]).toBe(
      format === "xlsx" ? "00000000000000000001" : "001234",
    );
  });
});
