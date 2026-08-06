/* global describe, it */

import { $, expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  assertPersistedContract,
  commitSummary,
  csvImportedContracts,
  defineNewCustomer,
  navigateToDataExchange,
  previewSummary,
  selectSyntheticContractFile,
  sourceDetailValues,
  waitForImportResult,
} from "../data-exchange.fixture.mjs";

describe("BODAM native CSV contract import write flow", () => {
  it("imports quoted multiline CSV rows through the release command path", async () => {
    await waitForNativeApp();
    await navigateToDataExchange();
    await selectSyntheticContractFile("synthetic-contracts-valid.csv", 2);

    expect(await previewSummary("전체")).toBe("2");
    expect(await previewSummary("유효")).toBe("2");
    expect(await previewSummary("중복 후보")).toBe("0");
    const source = await sourceDetailValues(3);
    expect(source["소속"]).toBe("가상,조직 \"넷\"");
    expect(source["계약"]).toContain("첫 줄");
    expect(source["계약"]).toContain("둘째 줄");
    expect(source["수금인코드"]).toBe("0000456");

    await defineNewCustomer(2, csvImportedContracts.row2.customerName);
    await defineNewCustomer(3, csvImportedContracts.row3.customerName);
    await $("[data-testid='commit-import']").click();
    const dialog = await $("dialog[open]");
    await dialog.waitForDisplayed();
    expect(await commitSummary(dialog, "새 계약")).toBe("2");
    expect(await commitSummary(dialog, "새 고객")).toBe("2");
    await dialog.$("[data-testid='confirm-import']").click();

    const result = await waitForImportResult();
    expect(await result.$("[data-result-count='created']").getText()).toBe("2");
    expect(await result.$("[data-result-count='skipped']").getText()).toBe("0");
    await assertPersistedContract(csvImportedContracts.row2);
    await assertPersistedContract(csvImportedContracts.row3);
  });
});
