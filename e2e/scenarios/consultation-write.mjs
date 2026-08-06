/* global document */

import { $, browser, expect } from "@wdio/globals";

import {
  consultationRowById,
  createConsultation,
  syntheticConsultations,
  updateConsultation,
  utcForLocalDateTime,
  waitForConsultationCount,
  waitForConsultationSection,
} from "../consultation.fixture.mjs";
import {
  searchCustomers,
  syntheticCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";
import { openCustomerInsurance } from "../policy.fixture.mjs";

export async function runConsultationWriteScenario() {
  await $("a[href='#/customers']").click();
  await waitForNativeApp();
  await searchCustomers(syntheticCustomer.updatedName);
  await openCustomerInsurance(await waitForOneCustomer(syntheticCustomer.updatedName));
  await waitForConsultationSection();
  await waitForConsultationCount(0);

  const createButton = await $("[data-testid='create-consultation']");
  await createButton.click();
  let dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("name"),
  )).toBe("consultedAt");
  expect(await dialog.$("#consultation-content-privacy").getText())
    .toContain("민감 병력");
  await browser.keys(["Escape"]);
  await dialog.waitForDisplayed({ reverse: true });
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-consultation");

  const fullId = await createConsultation(syntheticConsultations.full);
  const duplicateId = await createConsultation(syntheticConsultations.duplicate);
  expect(fullId).not.toBe(duplicateId);
  await waitForConsultationCount(2);

  let fullRow = await updateConsultation(fullId, syntheticConsultations.updated);
  expect(await browser.execute(
    () => document.activeElement?.getAttribute("data-testid"),
  )).toBe("create-consultation");
  expect(await fullRow.getText()).toContain(syntheticConsultations.updated.content);
  expect(await fullRow.getText()).toContain(syntheticConsultations.updated.result);
  expect(await fullRow.getText()).toContain("2026. 08. 25");
  expect(await fullRow.$("[data-testid='consulted-at']").getAttribute("datetime"))
    .toBe(utcForLocalDateTime(syntheticConsultations.updated.consultedAtLocal));
  expect(await fullRow.$("[data-testid='next-contact-on']").getAttribute("datetime"))
    .toBe(syntheticConsultations.updated.nextContactOn);

  await browser.refresh();
  await waitForConsultationSection();
  await waitForConsultationCount(2);
  fullRow = await consultationRowById(fullId);
  expect(await fullRow.getText()).toContain(syntheticConsultations.updated.content);
  expect(await (await consultationRowById(duplicateId)).getAttribute("data-consultation-id"))
    .toBe(duplicateId);

  dialog = await $("dialog[open]");
  expect(await dialog.isExisting()).toBe(false);
}
