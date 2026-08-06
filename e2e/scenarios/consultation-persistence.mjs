/* global document */

import { browser, expect } from "@wdio/globals";

import {
  deleteConsultation,
  syntheticConsultations,
  visibleConsultationRows,
  waitForConsultationCount,
  waitForConsultationSection,
} from "../consultation.fixture.mjs";

export async function runConsultationPersistenceScenario() {
  await waitForConsultationSection();
  const rows = await waitForConsultationCount(2);
  const ids = [];
  let updatedId;
  for (const row of rows) {
    const id = await row.getAttribute("data-consultation-id");
    if (id) ids.push(id);
    if ((await row.getText()).includes(syntheticConsultations.updated.content)) {
      updatedId = id;
      expect(await row.getText()).toContain(syntheticConsultations.updated.result);
    }
  }
  expect(new Set(ids).size).toBe(2);
  expect(updatedId).toBeTruthy();

  const removedId = ids.find((id) => id !== updatedId);
  if (!removedId) throw new Error("consultation selected for deletion was unavailable");
  await deleteConsultation(removedId);
  await waitForConsultationCount(1);
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-consultation");
  expect((await visibleConsultationRows()).length).toBe(1);
}
