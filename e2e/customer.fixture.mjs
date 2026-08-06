import { $, $$, browser, expect } from "@wdio/globals";

export const syntheticCustomer = Object.freeze({
  seed: "합성 고객 WDIO 002",
  updatedName: "합성 고객 WDIO 002 수정",
  phone: "010-0000-0002",
  status: "합성 상담 중",
});

export const syntheticFamilyCustomer = Object.freeze({
  name: "합성 가족 구성원 WDIO 005",
  phone: "010-0000-0005",
  status: "합성 가족 관리",
});

export async function waitForNativeApp() {
  const body = await $("body");
  await body.waitForExist({ timeout: 15_000 });
  const createButton = await $("[data-testid='create-customer']");
  try {
    await createButton.waitForDisplayed({ timeout: 10_000 });
  } catch (error) {
    const source = (await browser.getPageSource()).slice(0, 2_000);
    const title = await browser.getTitle();
    const url = await browser.getUrl();
    await browser.saveScreenshot(".runtime/wdio-logs/startup-failure.png");
    throw new Error(
      `native app not ready (title=${title}, url=${url}, source=${source})`,
      { cause: error },
    );
  }

  const isTauri = await browser.execute(
    () => "__TAURI_INTERNALS__" in globalThis,
  );
  expect(isTauri).toBe(true);
}

export async function searchCustomers(value) {
  const search = await $("input[aria-label='고객 검색']");
  await search.setValue(value);
  await browser.pause(350);
  await browser.waitUntil(
    async () => {
      const refreshState = await $(".refresh-state");
      return !(await refreshState.isDisplayed());
    },
    { timeout: 5_000, timeoutMsg: "customer search did not settle" },
  );
}

export async function customerRows() {
  return $$('[data-testid="customer-row"]');
}

export async function waitForOneCustomer(name) {
  await browser.waitUntil(
    async () => {
      const rows = await customerRows();
      return rows.length === 1 && (await rows[0].getText()).includes(name);
    },
    { timeout: 10_000, timeoutMsg: `customer row not found: ${name}` },
  );
  return (await customerRows())[0];
}

export async function createCustomer(customer) {
  await $("[data-testid='create-customer']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("input[name='name']").setValue(customer.name);
  if (customer.phone) {
    await dialog.$("input[name='phone']").setValue(customer.phone);
  }
  if (customer.status) {
    await dialog.$("input[name='status']").setValue(customer.status);
  }
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await searchCustomers(customer.name);
  return waitForOneCustomer(customer.name);
}

export async function removeCustomer(row) {
  const removeButton = await row.$(".row-actions .danger-action");
  await removeButton.click();

  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  const confirmButton = await dialog.$("button.is-danger");
  await confirmButton.click();
  await dialog.waitForDisplayed({ reverse: true });
}

export async function removeStaleSyntheticCustomers() {
  await searchCustomers(syntheticCustomer.seed);
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const rows = await customerRows();
    if (rows.length === 0) return;
    await removeCustomer(rows[0]);
    await searchCustomers(syntheticCustomer.seed);
  }
  throw new Error("stale synthetic customer cleanup did not finish");
}
