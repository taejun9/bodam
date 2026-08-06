/* global document */

import { $, browser, expect } from "@wdio/globals";

import {
  createBenchmark,
  expectOverlapRejected,
  navigateToBenchmarkSettings,
  openSyntheticCustomerDetail,
  syntheticBenchmarks,
  updateBenchmark,
  waitForBenchmarkCount,
  waitForCoverageClassification,
} from "../benchmark.fixture.mjs";

export async function runBenchmarkWriteScenario() {
  await waitForCoverageClassification(syntheticBenchmarks.adequate.categoryId, "unconfigured");
  const section = await navigateToBenchmarkSettings();
  expect(await section.getText()).toContain("공식 보험");

  const create = await $("[data-testid='create-benchmark']");
  await create.click();
  let dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("name"),
  )).toBe("categoryId");
  await browser.keys(["Escape"]);
  await dialog.waitForDisplayed({ reverse: true });
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-benchmark");

  const id = await createBenchmark(syntheticBenchmarks.adequate);
  await expectOverlapRejected(syntheticBenchmarks.adequate);
  await openSyntheticCustomerDetail();
  await waitForCoverageClassification(syntheticBenchmarks.adequate.categoryId, "adequate");

  await navigateToBenchmarkSettings();
  await updateBenchmark(id, syntheticBenchmarks.excessive);
  await openSyntheticCustomerDetail();
  await waitForCoverageClassification(syntheticBenchmarks.adequate.categoryId, "excessive");

  await navigateToBenchmarkSettings();
  await updateBenchmark(id, syntheticBenchmarks.insufficient);
  await browser.refresh();
  await waitForBenchmarkCount(1);
  expect(await (await waitForBenchmarkCount(1))[0].getAttribute("data-benchmark-id")).toBe(id);
  await openSyntheticCustomerDetail();
  await waitForCoverageClassification(syntheticBenchmarks.adequate.categoryId, "insufficient");
}
