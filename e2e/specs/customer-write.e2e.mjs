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

    const excludedRow = await waitForPolicy(syntheticPolicies.excluded.productName);
    await excludePolicy(excludedRow, syntheticPolicies.excluded.updatedPremium);
    await waitForPremium("120,000원");
    expect(await (await waitForPolicy(syntheticPolicies.excluded.productName)).getText())
      .toContain("제외");

    await browser.refresh();
    await waitForPolicyPage();
    await waitForPremium("120,000원");
  });
});
