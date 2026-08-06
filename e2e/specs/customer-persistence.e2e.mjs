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
    const includedPolicy = await waitForPolicy(syntheticPolicies.included.productName);
    await removePolicy(includedPolicy);
    expect((await policyRows()).length).toBe(1);
    await waitForPremium("0원");
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
