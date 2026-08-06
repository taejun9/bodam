/* global describe, document, it */

import { $, browser, expect } from "@wdio/globals";

import {
  removeStaleSyntheticCustomers,
  searchCustomers,
  syntheticCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";
import {
  closeCoverageManager,
  coverageCategoryIds,
  createCoverage,
  openCoverageManager,
  renameCoverageCategory,
  syntheticCoverages,
  updateCoverage,
  waitForCoverage,
  waitForCoverageSummary,
} from "../coverage.fixture.mjs";
import {
  createPolicy,
  excludePolicy,
  openCustomerInsurance,
  syntheticPolicies,
  waitForPolicy,
  waitForPolicyPage,
  waitForPremium,
} from "../policy.fixture.mjs";

describe("BODAM native customer and policy write flow", () => {
  it("persists customer and policy totals through real Tauri IPC", async () => {
    await waitForNativeApp();
    await removeStaleSyntheticCustomers();
    await searchCustomers("");

    const createButton = await $("[data-testid='create-customer']");
    await createButton.click();

    let createDialog = await $("dialog[open]");
    await createDialog.waitForDisplayed();
    expect(
      await browser.execute(() => document.activeElement?.getAttribute("name")),
    ).toBe("name");
    await browser.keys(["Escape"]);
    await createDialog.waitForDisplayed({ reverse: true });
    expect(
      await browser.execute(() => document.activeElement?.getAttribute("data-testid")),
    ).toBe("create-customer");

    await createButton.click();
    createDialog = await $("dialog[open]");
    await createDialog.waitForDisplayed();
    await createDialog.$("input[name='name']").setValue(syntheticCustomer.seed);
    await createDialog.$("input[name='phone']").setValue("010-0000-0001");
    await createDialog.$("input[name='status']").setValue("합성 신규");
    await createDialog.$("button[type='submit']").click();
    await createDialog.waitForDisplayed({ reverse: true });

    let row = await waitForOneCustomer(syntheticCustomer.seed);
    expect(await row.getText()).toContain("010-0000-0001");

    const editButton = await row.$(".row-actions button:not(.danger-action)");
    await editButton.click();

    const editDialog = await $("dialog[open]");
    await editDialog.waitForDisplayed();
    await editDialog.$("input[name='name']").setValue(syntheticCustomer.updatedName);
    await editDialog.$("input[name='phone']").setValue(syntheticCustomer.phone);
    await editDialog.$("input[name='status']").setValue(syntheticCustomer.status);
    await editDialog.$("button[type='submit']").click();
    await editDialog.waitForDisplayed({ reverse: true });

    await searchCustomers(syntheticCustomer.updatedName);
    row = await waitForOneCustomer(syntheticCustomer.updatedName);
    const rowText = await row.getText();
    expect(rowText).toContain(syntheticCustomer.phone);
    expect(rowText).toContain(syntheticCustomer.status);

    await browser.refresh();
    await waitForNativeApp();
    await searchCustomers(syntheticCustomer.updatedName);
    row = await waitForOneCustomer(syntheticCustomer.updatedName);

    await openCustomerInsurance(row);
    await createPolicy(syntheticPolicies.included, true);
    await createPolicy(syntheticPolicies.excluded);
    await waitForPremium("150,000원");

    let includedPolicyRow = await waitForPolicy(syntheticPolicies.included.productName);
    let coverageDialog = await openCoverageManager(includedPolicyRow);
    await createCoverage(coverageDialog, syntheticCoverages.includedCancer, true);
    await createCoverage(coverageDialog, syntheticCoverages.hospital);
    await closeCoverageManager(coverageDialog);
    await waitForCoverageSummary(coverageCategoryIds.cancer, "10000000", 1);
    await waitForCoverageSummary(coverageCategoryIds.hospital, "50000", 1);

    let excludedRow = await waitForPolicy(syntheticPolicies.excluded.productName);
    coverageDialog = await openCoverageManager(excludedRow);
    await createCoverage(coverageDialog, syntheticCoverages.excludedCancer);
    await closeCoverageManager(coverageDialog);
    await waitForCoverageSummary(coverageCategoryIds.cancer, "30000000", 2);

    await renameCoverageCategory(coverageCategoryIds.hospital, "암");
    includedPolicyRow = await waitForPolicy(syntheticPolicies.included.productName);
    coverageDialog = await openCoverageManager(includedPolicyRow);
    expect(await (await waitForCoverage(
      coverageDialog,
      coverageCategoryIds.cancer,
      syntheticCoverages.includedCancer.amount,
    )).getText()).toContain(`카테고리 ID ${coverageCategoryIds.cancer}`);
    expect(await (await waitForCoverage(
      coverageDialog,
      coverageCategoryIds.hospital,
      syntheticCoverages.hospital.amount,
    )).getText()).toContain(`카테고리 ID ${coverageCategoryIds.hospital}`);
    await closeCoverageManager(coverageDialog);
    expect(await (await waitForCoverageSummary(
      coverageCategoryIds.cancer,
      "30000000",
      2,
    )).getText()).toContain(`카테고리 ID ${coverageCategoryIds.cancer}`);
    expect(await (await waitForCoverageSummary(
      coverageCategoryIds.hospital,
      "50000",
      1,
    )).getText()).toContain(`카테고리 ID ${coverageCategoryIds.hospital}`);

    await renameCoverageCategory(coverageCategoryIds.hospital, "합성 입원 보장");
    expect(await (await waitForCoverageSummary(
      coverageCategoryIds.hospital,
      "50000",
      1,
    )).getText()).toContain("합성 입원 보장");

    excludedRow = await waitForPolicy(syntheticPolicies.excluded.productName);
    await excludePolicy(excludedRow, syntheticPolicies.excluded.updatedPremium);
    await waitForPremium("120,000원");
    expect(await (await waitForPolicy(syntheticPolicies.excluded.productName)).getText())
      .toContain("제외");
    await waitForCoverageSummary(coverageCategoryIds.cancer, "10000000", 1);

    includedPolicyRow = await waitForPolicy(syntheticPolicies.included.productName);
    coverageDialog = await openCoverageManager(includedPolicyRow);
    const cancerCoverage = await waitForCoverage(
      coverageDialog,
      coverageCategoryIds.cancer,
      syntheticCoverages.includedCancer.amount,
    );
    await updateCoverage(
      coverageDialog,
      cancerCoverage,
      coverageCategoryIds.cancer,
      syntheticCoverages.includedCancer.updatedAmount,
    );
    await closeCoverageManager(coverageDialog);
    await waitForCoverageSummary(coverageCategoryIds.cancer, "12000000", 1);

    await browser.refresh();
    await waitForPolicyPage();
    await waitForPremium("120,000원");
    await waitForCoverageSummary(coverageCategoryIds.cancer, "12000000", 1);
    expect(await (await waitForCoverageSummary(
      coverageCategoryIds.hospital,
      "50000",
      1,
    )).getText()).toContain("합성 입원 보장");
  });
});
