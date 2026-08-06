/* global describe, document, it */

import { $, browser, expect } from "@wdio/globals";

import {
  removeStaleSyntheticCustomers,
  searchCustomers,
  syntheticCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";

describe("BODAM native customer write flow", () => {
  it("creates, updates, and searches through real Tauri IPC", async () => {
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
    await waitForOneCustomer(syntheticCustomer.updatedName);
  });
});
