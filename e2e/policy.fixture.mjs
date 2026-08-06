import { $, $$, browser, expect } from "@wdio/globals";

export const syntheticPolicies = Object.freeze({
  included: Object.freeze({
    insurer: "합성손해보험",
    productName: "합성 안심보험 003",
    premium: "120000",
  }),
  excluded: Object.freeze({
    insurer: "합성생명보험",
    productName: "합성 생활보험 003",
    premium: "30000",
    updatedPremium: "35000",
  }),
});

export async function openCustomerInsurance(row) {
  const link = await row.$("[data-testid='customer-detail-link']");
  await link.click();
  await waitForPolicyPage();
}

export async function waitForPolicyPage() {
  const createButton = await $("[data-testid='create-policy']");
  await createButton.waitForDisplayed({ timeout: 10_000 });
  const isTauri = await browser.execute(() => "__TAURI_INTERNALS__" in globalThis);
  expect(isTauri).toBe(true);
}

export async function policyRows() {
  return $$('[data-testid="policy-row"]');
}

export async function waitForPolicy(productName) {
  await browser.waitUntil(
    async () => {
      const rows = await policyRows();
      for (const row of rows) {
        if ((await row.getText()).includes(productName)) return true;
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: `policy row not found: ${productName}` },
  );
  const rows = await policyRows();
  for (const row of rows) {
    if ((await row.getText()).includes(productName)) return row;
  }
  throw new Error("policy row disappeared after wait");
}

export async function waitForPremium(expected) {
  const total = await $("[data-testid='premium-total']");
  await browser.waitUntil(
    async () => (await total.getText()) === expected,
    { timeout: 10_000, timeoutMsg: `premium total did not become ${expected}` },
  );
}

export async function createPolicy(policy, verifyInvalidMoney = false) {
  await $("[data-testid='create-policy']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("input[name='insurer']").setValue(policy.insurer);
  await dialog.$("input[name='productName']").setValue(policy.productName);
  const premium = await dialog.$("input[name='monthlyPremiumWon']");

  if (verifyInvalidMoney) {
    await premium.setValue("-1");
    await dialog.$("button[type='submit']").click();
    expect(await dialog.getText()).toContain("0 이상의 원 단위 정수");
  }

  await premium.setValue(policy.premium);
  await dialog.$("input[name='joinedOn']").setValue("2026-01-15");
  await dialog.$("input[name='paymentTerm']").setValue("20년납");
  await dialog.$("input[name='status']").setValue("합성 유지");
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await waitForPolicy(policy.productName);
}

export async function excludePolicy(row, updatedPremium) {
  await row.$(".policy-actions button:not(.danger-action)").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("input[name='monthlyPremiumWon']").setValue(updatedPremium);
  const included = await dialog.$("input[name='isIncluded']");
  if (await included.isSelected()) await included.click();
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
}

export async function removePolicy(row) {
  await row.$(".policy-actions .danger-action").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("button.is-danger").click();
  await dialog.waitForDisplayed({ reverse: true });
}
