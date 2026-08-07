/* global document, Event */

import { $, $$, browser, expect } from "@wdio/globals";

import { searchCustomers, syntheticCustomer, waitForNativeApp, waitForOneCustomer } from "./customer.fixture.mjs";
import { coverageCategoryIds } from "./coverage.fixture.mjs";
import { openCustomerInsurance } from "./policy.fixture.mjs";

export const syntheticBenchmarks = Object.freeze({
  adequate: Object.freeze({
    categoryId: coverageCategoryIds.cancer,
    gender: syntheticCustomer.gender,
    minAgeYears: "0",
    maxAgeYears: "150",
    adequateMinWon: "12000000",
    excessiveMinWon: "20000000",
  }),
  excessive: Object.freeze({
    categoryId: coverageCategoryIds.cancer,
    gender: syntheticCustomer.gender,
    minAgeYears: "0",
    maxAgeYears: "150",
    adequateMinWon: "10000000",
    excessiveMinWon: "12000000",
  }),
  insufficient: Object.freeze({
    categoryId: coverageCategoryIds.cancer,
    gender: syntheticCustomer.gender,
    minAgeYears: "0",
    maxAgeYears: "150",
    adequateMinWon: "12000001",
    excessiveMinWon: "20000000",
  }),
});

const benchmarkItemSelector =
  "[data-testid='benchmark-row'], [data-testid='benchmark-card']";

function benchmarkItemByIdSelector(id) {
  return `[data-benchmark-id='${id}'][data-testid='benchmark-row'], ` +
    `[data-benchmark-id='${id}'][data-testid='benchmark-card']`;
}

async function selectCategory(dialog, categoryId) {
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

async function fillBenchmark(dialog, input) {
  await selectCategory(dialog, input.categoryId);
  await dialog.$("input[name='gender']").setValue(input.gender);
  await dialog.$("input[name='minAgeYears']").setValue(input.minAgeYears);
  await dialog.$("input[name='maxAgeYears']").setValue(input.maxAgeYears);
  await dialog.$("input[name='adequateMinWon']").setValue(input.adequateMinWon);
  await dialog.$("input[name='excessiveMinWon']").setValue(input.excessiveMinWon);
}

export async function navigateToBenchmarkSettings() {
  const link = await $("a[href='#/settings']");
  await link.click();
  const section = await $("[data-testid='benchmark-section']");
  await section.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => !(await section.getAttribute("aria-busy")) ||
      (await section.getAttribute("aria-busy")) === "false",
    { timeout: 10_000, timeoutMsg: "benchmark settings did not settle" },
  );
  return section;
}

export async function visibleBenchmarkRows() {
  const items = await $$(benchmarkItemSelector);
  const visibleById = new Map();
  for (const item of items) {
    if (!(await item.isDisplayed())) continue;
    const id = await item.getAttribute("data-benchmark-id");
    if (!id) throw new Error("visible benchmark item is missing its stable ID");
    if (!visibleById.has(id)) visibleById.set(id, item);
  }
  return [...visibleById.values()];
}

export async function waitForBenchmarkCount(count) {
  await browser.waitUntil(
    async () => {
      if ((await visibleBenchmarkRows()).length !== count) return false;
      if (count !== 0) return true;
      return (await $$(benchmarkItemSelector)).length === 0;
    },
    { timeout: 10_000, timeoutMsg: `benchmark count did not settle: ${count}` },
  );
  return visibleBenchmarkRows();
}

export async function benchmarkRowById(id) {
  let visibleItem;
  await browser.waitUntil(
    async () => {
      const items = await $$(benchmarkItemByIdSelector(id));
      for (const item of items) {
        if (await item.isDisplayed()) {
          visibleItem = item;
          return true;
        }
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: `benchmark item was not displayed: ${id}` },
  );
  return visibleItem;
}

export async function createBenchmark(input) {
  await $("[data-testid='create-benchmark']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillBenchmark(dialog, input);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  const rows = await waitForBenchmarkCount(1);
  const id = await rows[0].getAttribute("data-benchmark-id");
  expect(id).toBeTruthy();
  return id;
}

export async function expectOverlapRejected(input) {
  await $("[data-testid='create-benchmark']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillBenchmark(dialog, { ...input, minAgeYears: "100", maxAgeYears: "150" });
  await dialog.$("button[type='submit']").click();
  await browser.waitUntil(
    async () => (await dialog.getText()).includes("겹"),
    { timeout: 10_000, timeoutMsg: "overlap benchmark was not rejected" },
  );
  expect((await visibleBenchmarkRows()).length).toBe(1);
  const close = await dialog.$(".dialog-close");
  await browser.waitUntil(
    async () => (await dialog.getAttribute("aria-busy")) !== "true" &&
      (await close.isEnabled()),
    { timeout: 10_000, timeoutMsg: "rejected benchmark dialog did not settle" },
  );
  await close.click();
  await dialog.waitForDisplayed({ reverse: true });
  expect((await $$("dialog[open]")).length).toBe(0);
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-benchmark");
}

export async function updateBenchmark(id, input) {
  const row = await benchmarkRowById(id);
  await row.$("[data-testid='edit-benchmark']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillBenchmark(dialog, input);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  const updated = await benchmarkRowById(id);
  expect(await updated.getText()).toContain(
    new Intl.NumberFormat("ko-KR").format(BigInt(input.adequateMinWon)),
  );
  return updated;
}

export async function deleteBenchmark(id) {
  const row = await benchmarkRowById(id);
  await row.$("[data-testid='delete-benchmark']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("[data-testid='confirm-delete-benchmark']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await waitForBenchmarkCount(0);
}

export async function openSyntheticCustomerDetail() {
  await $("a[href='#/customers']").click();
  await waitForNativeApp();
  await searchCustomers(syntheticCustomer.updatedName);
  await openCustomerInsurance(await waitForOneCustomer(syntheticCustomer.updatedName));
}

export async function waitForCoverageClassification(categoryId, status) {
  const row = await $(`[data-testid='coverage-assessment-row'][data-category-id='${categoryId}']`);
  await row.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => {
      const chip = await row.$("[data-testid='coverage-classification']");
      return (await chip.isDisplayed()) &&
        (await chip.getAttribute("data-classification")) === status;
    },
    { timeout: 10_000, timeoutMsg: `coverage classification did not settle: ${status}` },
  );
  return row;
}
