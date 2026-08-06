/* global describe, document, it */

import { $, browser, expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  assertPersistedContract,
  commitSummary,
  defineNewCustomer,
  expectDefaultSkip,
  expectSkippedCustomerMissing,
  importedContracts,
  navigateToDataExchange,
  previewRow,
  previewSummary,
  selectSyntheticContractFile,
  sourceDetailValues,
  waitForImportResult,
} from "../data-exchange.fixture.mjs";

describe("BODAM native contract import write flow", () => {
  it("imports two explicitly assigned contracts and skips the batch duplicate", async () => {
    await waitForNativeApp();
    await navigateToDataExchange();
    await selectSyntheticContractFile();

    const desktopSize = await browser.getWindowSize();
    await browser.setWindowSize(390, 844);
    try {
      expect((await browser.getWindowSize()).width).toBe(390);
      expect(await $("[data-testid='import-preview-cards']").isDisplayed()).toBe(true);
      expect(await $("[data-testid='import-preview-table']").isDisplayed()).toBe(false);
      expect(await browser.execute(() =>
        document.documentElement.scrollWidth === document.documentElement.clientWidth
      )).toBe(true);
    } finally {
      await browser.setWindowSize(desktopSize.width, desktopSize.height);
    }

    expect(await previewSummary("전체")).toBe("3");
    expect(await previewSummary("유효")).toBe("3");
    expect(await previewSummary("중복 후보")).toBe("1");
    expect(await previewSummary("선택")).toBe("3");
    expect(await (await previewRow(3)).getText()).toContain("2행과 파일 내 중복");
    await expectDefaultSkip(3);
    const source = await sourceDetailValues(2);
    expect(source["수금인코드"]).toBe("001234");
    expect(source["증권번호"]).toBe("00A-12345678901234567890");
    expect(source["납입회차"]).toBe("012");
    expect(source["수금방법"]).toBe("비어 있음");

    await defineNewCustomer(2, importedContracts.row2.customerName);
    await defineNewCustomer(4, importedContracts.row4.customerName);

    await $("[data-testid='commit-import']").click();
    const dialog = await $("dialog[open]");
    await dialog.waitForDisplayed();
    expect(await commitSummary(dialog, "새 계약")).toBe("2");
    expect(await commitSummary(dialog, "건너뛰기")).toBe("1");
    expect(await commitSummary(dialog, "새 고객")).toBe("2");
    await dialog.$("[data-testid='confirm-import']").click();

    const result = await waitForImportResult();
    expect(await result.$("[data-result-count='created']").getText()).toBe("2");
    expect(await result.$("[data-result-count='updated']").getText()).toBe("0");
    expect(await result.$("[data-result-count='skipped']").getText()).toBe("1");
    expect(await result.$("[data-result-count='unselected']").getText()).toBe("0");
    expect(await result.$("[data-result-count='invalid']").getText()).toBe("0");

    await assertPersistedContract(importedContracts.row2);
    await assertPersistedContract(importedContracts.row4);
    await expectSkippedCustomerMissing();
  });
});
