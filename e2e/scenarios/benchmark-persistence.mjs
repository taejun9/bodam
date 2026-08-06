/* global document */

import { browser, expect } from "@wdio/globals";

import {
  deleteBenchmark,
  navigateToBenchmarkSettings,
  openSyntheticCustomerDetail,
  syntheticBenchmarks,
  waitForBenchmarkCount,
  waitForCoverageClassification,
} from "../benchmark.fixture.mjs";

export async function runBenchmarkPersistenceScenario() {
  await waitForCoverageClassification(
    syntheticBenchmarks.insufficient.categoryId,
    "insufficient",
  );
  await navigateToBenchmarkSettings();
  let rows = await waitForBenchmarkCount(1);
  const id = await rows[0].getAttribute("data-benchmark-id");
  expect(id).toBeTruthy();
  expect(await rows[0].getText()).toContain("12,000,001");

  await deleteBenchmark(id);
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-benchmark");
  await browser.refresh();
  rows = await waitForBenchmarkCount(0);
  expect(rows.length).toBe(0);

  await openSyntheticCustomerDetail();
  await waitForCoverageClassification(
    syntheticBenchmarks.insufficient.categoryId,
    "unconfigured",
  );
}
