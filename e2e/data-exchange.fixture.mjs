import { $, $$, browser, expect } from "@wdio/globals";

import {
  customerRows,
  searchCustomers,
  waitForNativeApp,
  waitForOneCustomer,
} from "./customer.fixture.mjs";
import {
  openCustomerInsurance,
  policyRows,
  waitForPolicy,
} from "./policy.fixture.mjs";

export const importedContracts = Object.freeze({
  row2: Object.freeze({
    sourceRow: 2,
    customerName: "합성계약자 하나",
    insurer: "가상손해보험",
    productName: "합성안심플랜",
    premium: "120,000원",
    joinedOn: "2024. 02. 29",
    maturesOn: "2034. 02. 28",
    paymentTerm: "10년",
    status: "유지",
  }),
  row4: Object.freeze({
    sourceRow: 4,
    customerName: "합성계약자 셋",
    insurer: "가상생명보험",
    productName: "합성윤년플랜",
    premium: "0원",
    joinedOn: "2020. 02. 29",
    maturesOn: "2040. 02. 29",
    paymentTerm: "—",
    status: "미입력",
  }),
});

export const csvImportedContracts = Object.freeze({
  row2: importedContracts.row2,
  row3: Object.freeze({
    sourceRow: 3,
    customerName: "합성계약자 넷",
    insurer: "가상생명보험",
    productName: "합성CSV플랜",
    premium: "34,000원",
    joinedOn: "2026. 08. 06",
    maturesOn: "—",
    paymentTerm: "20년",
    status: "유지",
  }),
});

export async function navigateToDataExchange() {
  const link = await $("a[href='#/data-exchange']");
  await link.click();
  const workspace = await $("[data-testid='data-exchange-workspace']");
  await workspace.waitForDisplayed({ timeout: 10_000 });
  expect(await browser.getUrl()).toContain("#/data-exchange");
  expect(await $("[data-testid='select-import-file']").isEnabled()).toBe(true);
}

export async function selectSyntheticContractFile(
  expectedName = "synthetic-contracts-valid.xlsx",
  expectedRows = 3,
) {
  await $("[data-testid='select-import-file']").click();
  const preview = await $("[data-testid='import-preview']");
  await preview.waitForDisplayed({ timeout: 15_000 });
  await browser.waitUntil(
    async () => (await previewRows()).length === expectedRows,
    { timeout: 10_000, timeoutMsg: `${expectedRows} import preview rows did not appear` },
  );
  expect(await preview.getText()).toContain(expectedName);
  return preview;
}

export async function previewRows() {
  return $$("[data-testid='import-preview-table'] [data-testid='import-row']");
}

export async function previewRow(sourceRow) {
  const row = await $(
    `[data-testid='import-preview-table'] [data-source-row='${sourceRow}']`,
  );
  await row.waitForExist();
  return row;
}

export async function previewSummary(label) {
  for (const item of await $$(".preview-counts > div")) {
    if (await item.$("dt").getText() === label) return item.$("dd").getText();
  }
  throw new Error(`import preview summary missing: ${label}`);
}

export async function commitSummary(dialog, label) {
  for (const item of await dialog.$$(".commit-summary dl > div")) {
    if (await item.$("dt").getText() === label) return item.$("dd").getText();
  }
  throw new Error(`import commit summary missing: ${label}`);
}

export async function defineNewCustomer(sourceRow, name) {
  const row = await previewRow(sourceRow);
  await row.$(`[data-new-customer-row='${sourceRow}']`).click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("input[name='newCustomerName']").setValue(name);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });

  const customer = await row.$(`select[aria-label='원본 ${sourceRow}행 연결 고객']`);
  expect(await customer.getValue()).toMatch(
    /^new:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  );
  expect(await customer.$("option:checked").getText()).toBe(name);
}

export async function sourceDetailValues(sourceRow) {
  const row = await previewRow(sourceRow);
  await row.$(".detail-toggle").click();
  const detail = await $(`#import-source-detail-${sourceRow} .source-detail`);
  await detail.waitForDisplayed();
  const values = {};
  const fields = await detail.$$("dl > div");
  expect(fields.length).toBe(21);
  for (const field of fields) {
    values[await field.$("dt").getText()] = await field.$("dd").getText();
  }
  return values;
}

export async function expectDefaultSkip(sourceRow) {
  const row = await previewRow(sourceRow);
  expect(await row.getAttribute("data-duplicate-state")).toBe("duplicate");
  const action = await row.$(`select[aria-label='원본 ${sourceRow}행 중복 처리']`);
  expect(await action.getValue()).toBe("skip");
  expect(await row.$(`input[aria-label='원본 ${sourceRow}행 선택']`).isSelected()).toBe(true);
  return row;
}

export async function waitForImportResult() {
  const result = await $("[data-testid='import-result']");
  await browser.waitUntil(async () => {
    if (await result.isDisplayed()) return true;
    const error = await $("dialog[open] [role='alert']");
    if (await error.isDisplayed()) {
      throw new Error(`contract import failed: ${await error.getText()}`);
    }
    return false;
  }, { timeout: 15_000, timeoutMsg: "contract import result did not appear" });
  return result;
}

export async function waitForImportConflict() {
  const error = await $(".import-state.is-error[role='alert']");
  await error.waitForDisplayed({ timeout: 15_000 });
  expect(await $("[data-testid='import-result']").isExisting()).toBe(false);
  expect(await $("[data-testid='import-preview']").isExisting()).toBe(false);
  expect(await $("dialog[open]").isExisting()).toBe(false);
  return error.getText();
}

export async function assertPersistedContract(contract) {
  await $("a[href='#/customers']").click();
  await waitForNativeApp();
  await searchCustomers(contract.customerName);
  const customer = await waitForOneCustomer(contract.customerName);
  await openCustomerInsurance(customer);
  const policy = await waitForPolicy(contract.productName);
  expect((await policyRows()).length).toBe(1);
  const text = await policy.getText();
  for (const value of [
    contract.insurer,
    contract.productName,
    contract.premium,
    contract.joinedOn,
    contract.maturesOn,
    contract.paymentTerm,
    contract.status,
  ]) {
    expect(text).toContain(value);
  }
}

export async function expectSkippedCustomerMissing() {
  await $("a[href='#/customers']").click();
  await waitForNativeApp();
  await searchCustomers("합성계약자 둘");
  expect((await customerRows()).length).toBe(0);
}
