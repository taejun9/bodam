/* global describe, it */

import { $, expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  commitSummary,
  defineNewCustomer,
  expectDefaultSkip,
  importedContracts,
  navigateToDataExchange,
  selectSyntheticContractFile,
  waitForImportConflict,
} from "../data-exchange.fixture.mjs";

describe("BODAM native contract import rollback flow", () => {
  it("rolls back earlier rows when the later synthetic source write fails", async () => {
    await waitForNativeApp();
    await navigateToDataExchange();
    await selectSyntheticContractFile();
    await expectDefaultSkip(3);
    await defineNewCustomer(2, importedContracts.row2.customerName);
    await defineNewCustomer(4, importedContracts.row4.customerName);

    await $("[data-testid='commit-import']").click();
    const dialog = await $("dialog[open]");
    await dialog.waitForDisplayed();
    expect(await commitSummary(dialog, "새 계약")).toBe("2");
    expect(await commitSummary(dialog, "건너뛰기")).toBe("1");
    await dialog.$("[data-testid='confirm-import']").click();

    const message = await waitForImportConflict();
    expect(message).toContain("데이터가 변경되었습니다");
    expect(message).toContain("파일을 다시 확인해 주세요");
  });
});
