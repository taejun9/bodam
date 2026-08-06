/* global describe, it */

import { $, expect } from "@wdio/globals";

import {
  customerRows,
  removeCustomer,
  searchCustomers,
  syntheticCustomer,
  syntheticFamilyCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";
import {
  addFamilyMember,
  closeFamilyMembers,
  deleteFamily,
  familyRows,
  findFamilyBySummary,
  navigateToFamilies,
  openFamilyMembers,
  removeFamilyMember,
  searchFamilies,
  syntheticFamilies,
  waitForFamilyMember,
  waitForFamilyMemberTotal,
  waitForFamilySummary,
} from "../family.fixture.mjs";
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

describe("BODAM native restart flow", () => {
  it("persists Family relations and applies active parent visibility after restart", async () => {
    await waitForNativeApp();
    await navigateToFamilies();
    let primaryRow = await findFamilyBySummary(syntheticFamilies.sharedName, 2, "200000");
    let duplicateRow = await findFamilyBySummary(syntheticFamilies.sharedName, 1, "120000");
    const primaryFamilyId = await primaryRow.getAttribute("data-family-id");
    const duplicateFamilyId = await duplicateRow.getAttribute("data-family-id");
    expect(primaryFamilyId).toBeTruthy();
    expect(duplicateFamilyId).toBeTruthy();
    expect(await primaryRow.getText()).toContain(`가족 ID ${primaryFamilyId}`);
    expect(await duplicateRow.getText()).toContain(`가족 ID ${duplicateFamilyId}`);

    let dialog = await openFamilyMembers(primaryFamilyId);
    expect(await (await waitForFamilyMember(dialog, syntheticCustomer.updatedName)).getText())
      .toContain(syntheticFamilies.primaryRelationship);
    let secondaryMember = await waitForFamilyMember(dialog, syntheticFamilyCustomer.name);
    expect(await secondaryMember.getText()).toContain(syntheticFamilies.secondaryRelationship);
    const originalMembershipId = await secondaryMember.getAttribute("data-membership-id");
    await waitForFamilyMemberTotal(dialog, 2, "200000");
    await closeFamilyMembers(dialog);

    await $("a[href='#/customers']").click();
    await waitForNativeApp();
    await searchCustomers(syntheticFamilyCustomer.name);
    const familyCustomerRow = await waitForOneCustomer(syntheticFamilyCustomer.name);
    await openCustomerInsurance(familyCustomerRow);
    const familyPolicy = await waitForPolicy(syntheticPolicies.familyMember.productName);
    await removePolicy(familyPolicy);
    await waitForPremium("0원");
    await $(".detail-breadcrumb a").click();
    await waitForNativeApp();

    await navigateToFamilies();
    await searchFamilies(syntheticFamilies.sharedName);
    await waitForFamilySummary(primaryFamilyId, 2, "120000");
    dialog = await openFamilyMembers(primaryFamilyId);
    secondaryMember = await waitForFamilyMember(dialog, syntheticFamilyCustomer.name);
    expect(await removeFamilyMember(dialog, secondaryMember)).toBe(originalMembershipId);
    await waitForFamilyMemberTotal(dialog, 1, "120000");
    const reactivated = await addFamilyMember(
      dialog,
      syntheticFamilyCustomer.name,
      syntheticFamilies.reactivatedRelationship,
    );
    expect(await reactivated.getAttribute("data-membership-id")).toBe(originalMembershipId);
    expect(await reactivated.getText()).toContain(syntheticFamilies.reactivatedRelationship);
    await waitForFamilyMemberTotal(dialog, 2, "120000");
    await closeFamilyMembers(dialog);

    await $("a[href='#/customers']").click();
    await waitForNativeApp();
    await searchCustomers(syntheticFamilyCustomer.name);
    await removeCustomer(await waitForOneCustomer(syntheticFamilyCustomer.name));

    await navigateToFamilies();
    await searchFamilies(syntheticFamilies.sharedName);
    await waitForFamilySummary(primaryFamilyId, 1, "120000");
    await waitForFamilySummary(duplicateFamilyId, 1, "120000");
    await deleteFamily(primaryFamilyId);
    await deleteFamily(duplicateFamilyId);
    await searchFamilies(syntheticFamilies.sharedName);
    expect((await familyRows()).length).toBe(0);

    await $("a[href='#/customers']").click();
    await waitForNativeApp();
  });

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
