/* global describe, it */

import { expect } from "@wdio/globals";

import { waitForNativeApp } from "../customer.fixture.mjs";
import {
  assertPersistedContract,
  csvImportedContracts,
  expectDefaultSkip,
  navigateToDataExchange,
  previewSummary,
  selectSyntheticContractFile,
} from "../data-exchange.fixture.mjs";

describe("BODAM native CSV contract import restart flow", () => {
  it("keeps CSV contracts and defaults the same rows to skip after restart", async () => {
    await waitForNativeApp();
    await assertPersistedContract(csvImportedContracts.row2);
    await assertPersistedContract(csvImportedContracts.row3);

    await navigateToDataExchange();
    await selectSyntheticContractFile("synthetic-contracts-valid.csv", 2);
    expect(await previewSummary("전체")).toBe("2");
    expect(await previewSummary("중복 후보")).toBe("2");
    await expectDefaultSkip(2);
    await expectDefaultSkip(3);
  });
});
