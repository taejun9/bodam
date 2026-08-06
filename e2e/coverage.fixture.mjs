/* global Event, document */

import { $, browser, expect } from "@wdio/globals";

export const coverageCategoryIds = Object.freeze({
  cancer: "10000000-0000-4000-8000-000000000001",
  brain: "10000000-0000-4000-8000-000000000003",
  hospital: "10000000-0000-4000-8000-000000000008",
});

export const syntheticCoverages = Object.freeze({
  includedCancer: Object.freeze({
    categoryId: coverageCategoryIds.cancer,
    amount: "10000000",
    updatedAmount: "12000000",
  }),
  excludedCancer: Object.freeze({
    categoryId: coverageCategoryIds.cancer,
    amount: "20000000",
  }),
  hospital: Object.freeze({
    categoryId: coverageCategoryIds.hospital,
    amount: "50000",
  }),
});

const formattedWon = (value) => `${new Intl.NumberFormat("ko-KR").format(BigInt(value))}원`;

async function selectCoverageCategory(dialog, categoryId) {
  const category = await dialog.$("select[name='categoryId']");
  await category.selectByAttribute("value", categoryId);
  await browser.execute(
    (element, value) => {
      element.value = value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
    },
    category,
    categoryId,
  );
  expect(await category.getValue()).toBe(categoryId);
}

export async function openCoverageManager(policyRow) {
  await policyRow.$("[data-testid='manage-coverage']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("[data-testid='policy-coverage-dialog']").waitForDisplayed();
  await dialog.$("[data-testid='create-coverage']").waitForDisplayed();
  await browser.waitUntil(
    async () => (await browser.execute(
      () => document.activeElement?.getAttribute("data-testid"),
    )) === "create-coverage",
    { timeout: 10_000, timeoutMsg: "coverage dialog autofocus did not settle" },
  );
  return dialog;
}

export async function closeCoverageManager(dialog) {
  await dialog.$(".dialog-close").click();
  await dialog.waitForDisplayed({ reverse: true });
}

export async function coverageRows(dialog) {
  return dialog.$$('[data-testid="coverage-row"]');
}

export async function waitForCoverage(dialog, categoryId, amount) {
  const selector = `[data-testid='coverage-row'][data-category-id='${categoryId}']`;
  try {
    await browser.waitUntil(
      async () => {
        const row = await dialog.$(selector);
        return (await row.isDisplayed()) && (await row.getText()).includes(formattedWon(amount));
      },
      { timeout: 10_000, timeoutMsg: `coverage did not settle: ${categoryId}` },
    );
  } catch (error) {
    await browser.saveScreenshot(".runtime/wdio-logs/coverage-settle-failure.png");
    throw new Error(
      `${String(error)}\nDialog state:\n${await dialog.getText()}`,
      { cause: error },
    );
  }
  return dialog.$(selector);
}

export async function createCoverage(dialog, coverage, verifyInvalidMoney = false) {
  await dialog.$("[data-testid='create-coverage']").click();
  const amount = await dialog.$("input[name='amountWon']");
  await selectCoverageCategory(dialog, coverage.categoryId);

  if (verifyInvalidMoney) {
    await amount.setValue("-1");
    await dialog.$("button[type='submit']").click();
    expect(await dialog.getText()).toContain("0 이상의 원 단위 정수");
    expect(await dialog.$("select[name='categoryId']").getAttribute("aria-invalid"))
      .toBe("false");
  }

  await amount.setValue(coverage.amount);
  await dialog.$("button[type='submit']").click();
  return waitForCoverage(dialog, coverage.categoryId, coverage.amount);
}

export async function updateCoverage(dialog, row, categoryId, amount) {
  await row.$(".coverage-row-actions button:not(.danger-action)").click();
  await selectCoverageCategory(dialog, categoryId);
  await dialog.$("input[name='amountWon']").setValue(amount);
  await dialog.$("button[type='submit']").click();
  return waitForCoverage(dialog, categoryId, amount);
}

export async function removeCoverage(dialog, row, categoryId) {
  await row.$(".coverage-row-actions .danger-action").click();
  await dialog.$("button.is-danger").click();
  await dialog.$("[data-testid='create-coverage']").waitForDisplayed();
  const selector = `[data-testid='coverage-row'][data-category-id='${categoryId}']`;
  await browser.waitUntil(
    async () => !(await dialog.$(selector).isExisting()),
    { timeout: 10_000, timeoutMsg: "coverage row was not removed" },
  );
}

async function openCategoryManager() {
  await $("[data-testid='manage-categories']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("[data-testid='category-settings-dialog']").waitForDisplayed();
  return dialog;
}

export async function waitForCoverageSummary(categoryId, amount, count) {
  const selector = `[data-testid='coverage-summary-row'][data-category-id='${categoryId}']`;
  await browser.waitUntil(
    async () => {
      const row = await $(selector);
      if (!(await row.isExisting())) return false;
      const text = await row.getText();
      return text.includes(formattedWon(amount)) && text.includes(`${count}건`);
    },
    { timeout: 10_000, timeoutMsg: `coverage summary did not settle: ${categoryId}` },
  );
  return $(selector);
}

export async function waitForCoverageSummaryMissing(categoryId) {
  const selector = `[data-testid='coverage-summary-row'][data-category-id='${categoryId}']`;
  await browser.waitUntil(
    async () => !(await $(selector).isExisting()),
    { timeout: 10_000, timeoutMsg: `coverage summary remained: ${categoryId}` },
  );
}

export async function renameCoverageCategory(categoryId, name) {
  const dialog = await openCategoryManager();
  const actionSelector = `[data-category-action='edit'][data-category-id='${categoryId}']`;
  await dialog.$(actionSelector).click();
  await dialog.$("input[name='name']").setValue(name);
  await dialog.$("button[type='submit']").click();
  await browser.waitUntil(
    async () => {
      if (await dialog.$("input[name='name']").isExisting()) return false;
      const action = await dialog.$(actionSelector);
      if (!(await action.isDisplayed())) return false;
      const rowText = await browser.execute(
        (element) => element.closest("li")?.textContent ?? "",
        action,
      );
      return rowText.includes(name);
    },
    { timeout: 10_000, timeoutMsg: "category rename did not settle" },
  );
  await dialog.$(".dialog-close").click();
  await dialog.waitForDisplayed({ reverse: true });
}

export async function deleteCoverageCategory(categoryId) {
  const dialog = await openCategoryManager();
  const targetSelector = `[data-category-action][data-category-id='${categoryId}']`;
  await dialog
    .$(`[data-category-action='delete'][data-category-id='${categoryId}']`)
    .click();
  await dialog.$("button.is-danger").click();
  await browser.waitUntil(
    async () =>
      (await dialog.$("[data-category-action='edit']").isDisplayed())
      && !(await dialog.$(targetSelector).isExisting()),
    { timeout: 10_000, timeoutMsg: "category delete did not settle" },
  );
  await dialog.$(".dialog-close").click();
  await dialog.waitForDisplayed({ reverse: true });

  const reopened = await openCategoryManager();
  await reopened.$("[data-category-action='edit']").waitForDisplayed();
  expect(await reopened.$(targetSelector).isExisting()).toBe(false);
  await reopened.$(".dialog-close").click();
  await reopened.waitForDisplayed({ reverse: true });
}
