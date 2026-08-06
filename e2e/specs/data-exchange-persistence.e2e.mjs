/* global describe, it */

import { expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  assertPersistedContract,
  expectDefaultSkip,
  expectSkippedCustomerMissing,
  importedContracts,
  navigateToDataExchange,
  previewSummary,
  selectSyntheticContractFile,
} from "../data-exchange.fixture.mjs";

describe("BODAM native contract import restart flow", () => {
  it("keeps imported contracts and previews the same file as duplicates", async () => {
    await waitForNativeApp();
    await assertPersistedContract(importedContracts.row2);
    await assertPersistedContract(importedContracts.row4);
    await expectSkippedCustomerMissing();

    await navigateToDataExchange();
    await selectSyntheticContractFile();
    expect(await previewSummary("전체")).toBe("3");
    expect(await previewSummary("중복 후보")).toBe("3");
    expect(await previewSummary("선택")).toBe("3");
    await expectDefaultSkip(2);
    await expectDefaultSkip(3);
    await expectDefaultSkip(4);
  });
});
