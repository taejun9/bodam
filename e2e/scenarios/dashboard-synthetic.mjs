import { $ } from "@wdio/globals";

import { syntheticBenchmarks } from "../benchmark.fixture.mjs";
import {
  consultationRowById,
  syntheticConsultations,
  utcForLocalDateTime,
  visibleConsultationRows,
  waitForConsultationSection,
} from "../consultation.fixture.mjs";
import { searchCustomers, syntheticCustomer, syntheticFamilyCustomer, waitForNativeApp, waitForOneCustomer } from "../customer.fixture.mjs";
import {
  dashboardReferenceDate,
  expectDashboardCard,
  expectDashboardMetricSet,
  navigateToDashboard,
} from "../dashboard.fixture.mjs";
import { findFamilyBySummary, navigateToFamilies, syntheticFamilies } from "../family.fixture.mjs";
import { openCustomerInsurance, syntheticPolicies, waitForPolicy } from "../policy.fixture.mjs";

async function requiredAttribute(element, name) {
  const value = await element.getAttribute(name);
  if (!value) throw new Error(`synthetic source is missing ${name}`);
  return value;
}

async function customerIdFromRow(row) {
  const href = await row.$("[data-testid='customer-detail-link']").getAttribute("href");
  const match = href?.match(/#\/customers\/([^/?#]+)$/);
  if (!match?.[1]) throw new Error(`synthetic customer href has no stable ID: ${href}`);
  return decodeURIComponent(match[1]);
}

async function policyIdFromRow(row) {
  return requiredAttribute(await row.$("[data-testid='manage-coverage']"), "data-policy-id");
}

async function activeConsultationIds() {
  await waitForConsultationSection();
  const ids = [];
  let recentConsultationId;
  for (const row of await visibleConsultationRows()) {
    const id = await requiredAttribute(row, "data-consultation-id");
    ids.push(id);
    if ((await row.getText()).includes(syntheticConsultations.updated.content)) {
      await consultationRowById(id);
      recentConsultationId = id;
    }
  }
  const duplicateConsultationId = ids.find((id) => id !== recentConsultationId);
  if (!recentConsultationId || !duplicateConsultationId || ids.length !== 2) {
    throw new Error("synthetic consultation identities were not found");
  }
  return { duplicateConsultationId, recentConsultationId };
}

async function captureSyntheticSourceIds() {
  await waitForNativeApp();
  await searchCustomers(syntheticCustomer.updatedName);
  const primaryRow = await waitForOneCustomer(syntheticCustomer.updatedName);
  const primaryCustomerId = await customerIdFromRow(primaryRow);
  await openCustomerInsurance(primaryRow);
  const maturityPolicyId = await policyIdFromRow(
    await waitForPolicy(syntheticPolicies.excluded.productName),
  );
  const { duplicateConsultationId, recentConsultationId } =
    await activeConsultationIds();

  await $("a[href='#/customers']").click();
  await waitForNativeApp();
  await searchCustomers(syntheticFamilyCustomer.name);
  const secondaryCustomerId = await customerIdFromRow(
    await waitForOneCustomer(syntheticFamilyCustomer.name),
  );

  await navigateToFamilies();
  const primaryFamilyId = await requiredAttribute(
    await findFamilyBySummary(syntheticFamilies.sharedName, 2, "200000"),
    "data-family-id",
  );
  const duplicateFamilyId = await requiredAttribute(
    await findFamilyBySummary(syntheticFamilies.sharedName, 1, "120000"),
    "data-family-id",
  );
  return {
    duplicateFamilyId,
    duplicateConsultationId,
    maturityPolicyId,
    primaryCustomerId,
    primaryFamilyId,
    recentConsultationId,
    secondaryCustomerId,
  };
}

const customerLink = (customerId) => `#/customers/${customerId}`;

export async function verifySyntheticDashboard() {
  const ids = await captureSyntheticSourceIds();
  await navigateToDashboard();
  await expectDashboardMetricSet();

  await expectDashboardCard("today-contact", {
    totalCount: 1,
    items: [{
      itemId: ids.primaryCustomerId,
      attributes: { "data-customer-id": ids.primaryCustomerId },
      dateTimes: [syntheticConsultations.updated.nextContactOn],
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    }],
  });
  await expectDashboardCard("insurance-age", {
    totalCount: 1,
    items: [{
      itemId: ids.primaryCustomerId,
      attributes: {
        "data-bucket": "0-30",
        "data-customer-id": ids.primaryCustomerId,
        "data-insurance-age": "27",
      },
      dateTimes: ["2026-08-15"],
      text: [syntheticCustomer.updatedName, "27세"],
      href: customerLink(ids.primaryCustomerId),
    }],
  });
  await expectDashboardCard("maturity", {
    totalCount: 1,
    items: [{
      itemId: ids.maturityPolicyId,
      attributes: {
        "data-bucket": "0-30",
        "data-customer-id": ids.primaryCustomerId,
        "data-policy-id": ids.maturityPolicyId,
      },
      dateTimes: [syntheticPolicies.excluded.maturesOn],
      text: [syntheticCustomer.updatedName, syntheticPolicies.excluded.productName],
      href: customerLink(ids.primaryCustomerId),
    }],
  });
  await expectDashboardCard("premium-top", {
    totalCount: 2,
    items: [
      {
        itemId: ids.primaryCustomerId,
        attributes: { "data-customer-id": ids.primaryCustomerId },
        amountWon: "120000",
        text: [syntheticCustomer.updatedName],
        href: customerLink(ids.primaryCustomerId),
      },
      {
        itemId: ids.secondaryCustomerId,
        attributes: { "data-customer-id": ids.secondaryCustomerId },
        amountWon: "80000",
        text: [syntheticFamilyCustomer.name],
        href: customerLink(ids.secondaryCustomerId),
      },
    ],
  });
  await expectDashboardCard("family-premium", {
    totalCount: 2,
    items: [
      {
        itemId: ids.primaryFamilyId,
        attributes: { "data-family-id": ids.primaryFamilyId },
        amountWon: "200000",
        text: [syntheticFamilies.sharedName, "2명"],
        href: "#/families",
      },
      {
        itemId: ids.duplicateFamilyId,
        attributes: { "data-family-id": ids.duplicateFamilyId },
        amountWon: "120000",
        text: [syntheticFamilies.sharedName, "1명"],
        href: "#/families",
      },
    ],
  });
  await expectDashboardCard("coverage-insufficient", {
    totalCount: 1,
    items: [{
      itemId: ids.primaryCustomerId,
      attributes: {
        "data-category-ids": syntheticBenchmarks.insufficient.categoryId,
        "data-customer-id": ids.primaryCustomerId,
      },
      categories: [{
        id: syntheticBenchmarks.insufficient.categoryId,
        amountWon: "12000000",
        adequateMinWon: syntheticBenchmarks.insufficient.adequateMinWon,
        shortfallWon: "1",
      }],
      text: [syntheticCustomer.updatedName, "부족 1개"],
      href: customerLink(ids.primaryCustomerId),
    }],
  });
  await expectDashboardCard("recent-consultation", {
    totalCount: 1,
    items: [{
      itemId: ids.recentConsultationId,
      attributes: {
        "data-consultation-id": ids.recentConsultationId,
        "data-customer-id": ids.primaryCustomerId,
      },
      dateTimes: [utcForLocalDateTime(syntheticConsultations.updated.consultedAtLocal)],
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    }],
  });
  await expectDashboardCard("unconsulted", {
    totalCount: 1,
    items: [{
      itemId: ids.secondaryCustomerId,
      attributes: { "data-customer-id": ids.secondaryCustomerId },
      dateTimes: [],
      text: [syntheticFamilyCustomer.name, "상담 기록 없음"],
      href: customerLink(ids.secondaryCustomerId),
    }],
  });

  return { ids, referenceDate: dashboardReferenceDate };
}
