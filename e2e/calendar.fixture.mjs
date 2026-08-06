/* global Event, sessionStorage */

import { readFileSync, writeFileSync } from "node:fs";
import process from "node:process";

import { $, $$, browser, expect } from "@wdio/globals";

export const calendarReferenceDate = "2026-08-06";

export const syntheticSchedules = Object.freeze({
  linkedDraft: Object.freeze({
    title: "합성 일정 WDIO 009",
    scheduledOn: calendarReferenceDate,
    scheduledTime: "14:20",
    memo: "합성 일정 메모 WDIO 009 — 고객 후속 서류 확인",
    isCompleted: false,
  }),
  linkedUpdated: Object.freeze({
    title: "합성 일정 WDIO 009 수정",
    scheduledOn: calendarReferenceDate,
    scheduledTime: "15:40",
    memo: "합성 일정 메모 WDIO 009 수정 — 후속 자료 확인",
    isCompleted: false,
  }),
  linkedPersisted: Object.freeze({
    title: "합성 일정 WDIO 009 수정",
    scheduledOn: calendarReferenceDate,
    scheduledTime: "15:40",
    memo: "합성 일정 메모 WDIO 009 수정 — 후속 자료 확인",
    isCompleted: true,
  }),
  removed: Object.freeze({
    title: "합성 삭제 일정 WDIO 009",
    scheduledOn: calendarReferenceDate,
    scheduledTime: null,
    memo: null,
    isCompleted: false,
  }),
});

const referenceDateStorageKey = "bodam:e2e-calendar-reference-date";
const databasePath = process.env.BODAM_E2E_DB_PATH;
const statePath = databasePath ? `${databasePath}.calendar-state.json` : undefined;

function requiredStatePath() {
  if (!statePath) throw new Error("BODAM_E2E_DB_PATH is required for Calendar state");
  return statePath;
}

export function saveCalendarState(state) {
  writeFileSync(requiredStatePath(), `${JSON.stringify(state)}\n`, {
    encoding: "utf8",
    mode: 0o600,
  });
}

export function loadCalendarState() {
  const value = JSON.parse(readFileSync(requiredStatePath(), "utf8"));
  for (const field of [
    "linkedScheduleId",
    "removedScheduleId",
    "customerId",
    "duplicateConsultationId",
    "maturityPolicyId",
    "recentConsultationId",
  ]) {
    if (typeof value[field] !== "string" || value[field].length === 0) {
      throw new Error(`persisted Calendar state is missing ${field}`);
    }
  }
  return value;
}

export async function setCalendarReferenceDate() {
  await browser.execute((key, date) => sessionStorage.setItem(key, date),
    referenceDateStorageKey, calendarReferenceDate);
}

export async function navigateToCalendar() {
  await setCalendarReferenceDate();
  const link = await $("a[href='#/calendar']");
  await link.waitForDisplayed({ timeout: 10_000 });
  await link.click();
  return waitForCalendarPage();
}

export async function waitForCalendarPage() {
  const page = await $("[data-testid='calendar-page']");
  await page.waitForDisplayed({ timeout: 15_000 });
  await browser.waitUntil(
    async () => (await page.getAttribute("aria-busy")) !== "true" &&
      (await $$("[data-calendar-date]")).length === 31,
    { timeout: 20_000, timeoutMsg: "Calendar month read model did not settle" },
  );
  expect(await $("[data-testid='calendar-month-label']").getText()).toBe("2026년 8월");
  expect(await browser.getUrl()).toContain("month=2026-08");
  expect(await browser.getUrl()).toContain("date=2026-08-06");
  return page;
}

export async function selectedAgendaEvent(eventId) {
  const item = await $(`.calendar-agenda-item[data-event-id='${eventId}']`);
  await item.waitForDisplayed({ timeout: 10_000 });
  return item;
}

export async function calendarGridEvent(date, eventId) {
  const day = await $(`[data-calendar-date='${date}']`);
  await day.waitForDisplayed({ timeout: 10_000 });
  const event = await day.$(`[data-event-id='${eventId}']`);
  await event.waitForDisplayed({ timeout: 10_000 });
  return event;
}

export async function calendarGridEventOrder(date) {
  const day = await $(`[data-calendar-date='${date}']`);
  await day.waitForDisplayed({ timeout: 10_000 });
  const order = [];
  for (const event of await day.$$('[data-event-kind]')) {
    order.push({
      dateTime: await event.$("time").getAttribute("datetime"),
      id: await event.getAttribute("data-event-id"),
    });
  }
  return order;
}

export async function visibleCalendarKinds() {
  const kinds = new Set();
  for (const event of await $(".calendar-grid").$$('[data-event-kind]')) {
    if (await event.isDisplayed()) kinds.add(await event.getAttribute("data-event-kind"));
  }
  return [...kinds].sort();
}

export async function createSchedule(input, customerId = null) {
  await $("[data-testid='create-schedule']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillScheduleForm(dialog, input, customerId);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  return waitForNewSchedule(input.title);
}

export async function updateSchedule(id, input, customerId) {
  const event = await selectedAgendaEvent(`schedule:${id}`);
  await event.$(".calendar-schedule-title").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillScheduleForm(dialog, input, customerId);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await browser.waitUntil(
    async () => {
      const text = await (await selectedAgendaEvent(`schedule:${id}`)).getText();
      return text.includes(input.title);
    },
    { timeout: 10_000, timeoutMsg: "updated Schedule did not settle" },
  );
}

export async function completeSchedule(id) {
  const event = await selectedAgendaEvent(`schedule:${id}`);
  await (await buttonWithText(event, "완료")).click();
  await browser.waitUntil(
    async () => {
      const text = await (await selectedAgendaEvent(`schedule:${id}`)).getText();
      return text.includes("완료한 사용자 일정");
    },
    { timeout: 10_000, timeoutMsg: "Schedule completion did not settle" },
  );
}

export async function deleteSchedule(id) {
  const eventId = `schedule:${id}`;
  const event = await selectedAgendaEvent(eventId);
  await (await buttonWithText(event, "삭제")).click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await (await buttonWithText(dialog, "일정 삭제")).click();
  await dialog.waitForDisplayed({ reverse: true });
  await browser.waitUntil(
    async () => !(await (await $(
      `.calendar-agenda-item[data-event-id='${eventId}']`,
    )).isExisting()),
    { timeout: 10_000, timeoutMsg: "soft-deleted Schedule remained visible" },
  );
}

export async function expectScheduleDetails(id, expected, customerId) {
  const event = await selectedAgendaEvent(`schedule:${id}`);
  expect(await event.getAttribute("data-event-kind")).toBe("schedule");
  expect(await event.$("time").getAttribute("datetime"))
    .toBe(`${expected.scheduledOn}T${expected.scheduledTime}:00`);
  const text = await event.getText();
  expect(text).toContain(expected.title);
  expect(text).toContain(expected.memo);
  expect(text).toContain(expected.isCompleted ? "완료한 사용자 일정" : "사용자 일정");
  const customerLink = await event.$(".calendar-customer-link");
  expect(await customerLink.isDisplayed()).toBe(true);
  expect(await customerLink.getAttribute("href")).toContain(`/customers/${customerId}`);
  expect(await event.getAttribute("class")).toContain("is-completed");
}

export async function expectUnlinkedAllDaySchedule(id, expected) {
  const event = await selectedAgendaEvent(`schedule:${id}`);
  expect(await event.getAttribute("data-event-kind")).toBe("schedule");
  expect(await event.$("time").getAttribute("datetime")).toBe(expected.scheduledOn);
  expect(await event.getText()).toContain(expected.title);
  expect(await event.$(".calendar-customer-link").isExisting()).toBe(false);
}

export async function expectEventAbsent(id, title) {
  expect((await $$(`[data-event-id='schedule:${id}']`)).length).toBe(0);
  expect(await $("[data-testid='calendar-page']").getText()).not.toContain(title);
}

async function waitForNewSchedule(title) {
  let id;
  await browser.waitUntil(async () => {
    for (const event of await $$(".calendar-agenda-item[data-event-kind='schedule']")) {
      if ((await event.getText()).includes(title)) {
        const eventId = await event.getAttribute("data-event-id");
        if (eventId?.startsWith("schedule:")) id = eventId.slice("schedule:".length);
      }
    }
    return Boolean(id);
  }, { timeout: 10_000, timeoutMsg: `created Schedule did not appear: ${title}` });
  if (!id || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(id)) {
    throw new Error(`created Schedule has no UUID identity: ${id}`);
  }
  return id;
}

async function fillScheduleForm(dialog, input, customerId) {
  await dialog.$("input[name='title']").setValue(input.title);
  await dialog.$("input[name='scheduledOn']").setValue(input.scheduledOn);
  await dialog.$("input[name='scheduledTime']").setValue(input.scheduledTime ?? "");
  await dialog.$("textarea[name='memo']").setValue(input.memo ?? "");
  const customerSelect = await dialog.$("select[name='customerId']");
  const selectedCustomerId = customerId ?? "";
  await browser.execute((element, value) => {
    element.value = value;
    element.dispatchEvent(new Event("change", { bubbles: true }));
  }, customerSelect, selectedCustomerId);
  expect(await customerSelect.getValue()).toBe(selectedCustomerId);
  const completed = await dialog.$("input[name='isCompleted']");
  if ((await completed.isSelected()) !== input.isCompleted) await completed.click();
}

async function buttonWithText(scope, text) {
  for (const button of await scope.$$("button")) {
    if ((await button.getText()).trim() === text) return button;
  }
  throw new Error(`button was not found: ${text}`);
}
