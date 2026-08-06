/* global sessionStorage */

import { $, $$, browser, expect } from "@wdio/globals";

export const dashboardReferenceDate = "2026-08-06";
export const dashboardReferenceInstant = "2026-08-06T14:59:59.999Z";

export const dashboardMetrics = Object.freeze([
  "today-contact",
  "insurance-age",
  "maturity",
  "premium-top",
  "family-premium",
  "coverage-insufficient",
  "recent-consultation",
  "unconsulted",
]);

const referenceDateStorageKey = "bodam:e2e-dashboard-reference-date";
const referenceInstantStorageKey = "bodam:e2e-dashboard-reference-instant";

export async function setDashboardReferenceDate() {
  await browser.execute(
    (dateKey, date, instantKey, instant) => {
      sessionStorage.setItem(dateKey, date);
      sessionStorage.setItem(instantKey, instant);
    },
    referenceDateStorageKey,
    dashboardReferenceDate,
    referenceInstantStorageKey,
    dashboardReferenceInstant,
  );
}

export async function navigateToDashboard() {
  await setDashboardReferenceDate();
  const link = await $("a[href='#/dashboard']");
  await link.waitForDisplayed({ timeout: 10_000 });
  await link.click();
  return waitForDashboardPage();
}

export async function waitForDashboardPage() {
  const page = await $("[data-testid='dashboard-page']");
  await page.waitForDisplayed({ timeout: 15_000 });
  await browser.waitUntil(
    async () => {
      if ((await page.getAttribute("aria-busy")) === "true") return false;
      const cards = await $$("section[data-dashboard-metric]");
      if (cards.length !== dashboardMetrics.length) return false;
      for (const card of cards) {
        if ((await card.getAttribute("data-total-count")) === null) return false;
      }
      return true;
    },
    { timeout: 20_000, timeoutMsg: "dashboard read model did not settle" },
  );

  const reference = await page.$("[data-testid='dashboard-reference-date']");
  await reference.waitForDisplayed();
  expect(await reference.getAttribute("datetime")).toBe(dashboardReferenceDate);
  return page;
}

export async function dashboardCard(metric) {
  const card = await $(`section[data-dashboard-metric='${metric}']`);
  await card.waitForDisplayed({ timeout: 10_000 });
  return card;
}

export async function visibleDashboardItems(metric) {
  const card = await dashboardCard(metric);
  const visibleById = new Map();
  for (const item of await card.$$('[data-testid="dashboard-item"]')) {
    if (!(await item.isDisplayed())) continue;
    const id = await item.getAttribute("data-item-id");
    if (!id) throw new Error(`${metric} dashboard item is missing its stable ID`);
    if (!visibleById.has(id)) visibleById.set(id, item);
  }
  return [...visibleById.values()];
}

async function visibleDateTimes(item) {
  const values = [];
  for (const time of await item.$$("time[datetime]")) {
    if (await time.isDisplayed()) values.push(await time.getAttribute("datetime"));
  }
  return values;
}

async function expectDashboardItem(item, expected) {
  expect(await item.getAttribute("data-item-id")).toBe(expected.itemId);
  for (const [name, value] of Object.entries(expected.attributes ?? {})) {
    expect(await item.getAttribute(name)).toBe(value);
  }
  if (expected.amountWon !== undefined) {
    expect(await item.getAttribute("data-amount-won")).toBe(expected.amountWon);
  }
  if (expected.dateTimes !== undefined) {
    expect(await visibleDateTimes(item)).toEqual(expected.dateTimes);
  }
  const text = await item.getText();
  for (const token of expected.text ?? []) expect(text).toContain(token);
  if (expected.href) {
    const link = await item.$(`a[href='${expected.href}']`);
    expect(await link.isDisplayed()).toBe(true);
  }
  for (const category of expected.categories ?? []) {
    const row = await item.$(`[data-category-id='${category.id}']`);
    await row.waitForDisplayed();
    expect(await row.getAttribute("data-amount-won")).toBe(category.amountWon);
    expect(await row.getAttribute("data-adequate-min-won")).toBe(category.adequateMinWon);
    expect(await row.getAttribute("data-shortfall-won")).toBe(category.shortfallWon);
  }
}

export async function expectDashboardCard(metric, expected) {
  const card = await dashboardCard(metric);
  expect(await card.getAttribute("data-total-count")).toBe(String(expected.totalCount));
  const items = await visibleDashboardItems(metric);
  expect(items.length).toBe(expected.items.length);
  for (let index = 0; index < items.length; index += 1) {
    await expectDashboardItem(items[index], expected.items[index]);
  }
}

export async function expectDashboardMetricSet() {
  const metrics = [];
  for (const card of await $$("section[data-dashboard-metric]")) {
    if (await card.isDisplayed()) metrics.push(await card.getAttribute("data-dashboard-metric"));
  }
  expect(metrics.sort()).toEqual([...dashboardMetrics].sort());
}
