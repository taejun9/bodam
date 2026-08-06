/* global describe, it */

import { $, expect } from "@wdio/globals";

import {
  customerRows,
  removeCustomer,
  searchCustomers,
  syntheticCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";
import {
  closeCoverageManager,
  coverageCategoryIds,
  deleteCoverageCategory,
  openCoverageManager,
  removeCoverage,
  syntheticCoverages,
  waitForCoverage,
  waitForCoverageSummary,
  waitForCoverageSummaryMissing,
} from "../coverage.fixture.mjs";
import {
  openCustomerInsurance,
  policyRows,
  removePolicy,
  syntheticPolicies,
  waitForPolicy,
  waitForPremium,
} from "../policy.fixture.mjs";

describe("BODAM native customer and policy restart flow", () => {
  it("persists policy state and soft-deletes from active reads after restart", async () => {
    await waitForNativeApp();
    await searchCustomers(syntheticCustomer.updatedName);

    const row = await waitForOneCustomer(syntheticCustomer.updatedName);
    const rowText = await row.getText();
    expect(rowText).toContain(syntheticCustomer.phone);
    expect(rowText).toContain(syntheticCustomer.status);

    await openCustomerInsurance(row);
    expect((await policyRows()).length).toBe(2);
    await waitForPremium("120,000원");
    await waitForCoverageSummary(coverageCategoryIds.cancer, "12000000", 1);
    expect(await (await waitForCoverageSummary(
      coverageCategoryIds.hospital,
      "50000",
      1,
    )).getText()).toContain("합성 입원 보장");

    const excludedPolicy = await waitForPolicy(syntheticPolicies.excluded.productName);
    let coverageDialog = await openCoverageManager(excludedPolicy);
    expect(await coverageDialog.getText()).toContain("고객 보장 합계에는 반영되지 않습니다");
    await waitForCoverage(
      coverageDialog,
      coverageCategoryIds.cancer,
      syntheticCoverages.excludedCancer.amount,
    );
    await closeCoverageManager(coverageDialog);

    const includedPolicy = await waitForPolicy(syntheticPolicies.included.productName);
    coverageDialog = await openCoverageManager(includedPolicy);
    const cancerCoverage = await waitForCoverage(
      coverageDialog,
      coverageCategoryIds.cancer,
      syntheticCoverages.includedCancer.updatedAmount,
    );
    await removeCoverage(coverageDialog, cancerCoverage, coverageCategoryIds.cancer);
    await closeCoverageManager(coverageDialog);
    await waitForCoverageSummaryMissing(coverageCategoryIds.cancer);
    await waitForCoverageSummary(coverageCategoryIds.hospital, "50000", 1);

    await deleteCoverageCategory(coverageCategoryIds.brain);
    await removePolicy(includedPolicy);
    expect((await policyRows()).length).toBe(1);
    await waitForPremium("0원");
    await waitForCoverageSummaryMissing(coverageCategoryIds.hospital);
    expect(await (await waitForPolicy(syntheticPolicies.excluded.productName)).getText())
      .toContain("35,000원");

    await $(".detail-breadcrumb a").click();
    await searchCustomers(syntheticCustomer.updatedName);
    const persistedCustomer = await waitForOneCustomer(syntheticCustomer.updatedName);
    await removeCustomer(persistedCustomer);
    await searchCustomers(syntheticCustomer.seed);
    expect((await customerRows()).length).toBe(0);

  });
});
