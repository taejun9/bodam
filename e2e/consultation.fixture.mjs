import { $, $$, browser } from "@wdio/globals";

export const syntheticConsultations = Object.freeze({
  full: Object.freeze({
    consultedAtLocal: "2026-08-05T09:30",
    content: "합성 상담 기록 WDIO 006 — 요청 사항과 다음 연락 일정 확인",
    nextContactOn: "2026-08-20",
    result: "합성 후속 확인",
  }),
  duplicate: Object.freeze({
    consultedAtLocal: "2026-08-05T09:30",
    content: null,
    nextContactOn: null,
    result: null,
  }),
  updated: Object.freeze({
    consultedAtLocal: "2026-08-05T09:31",
    content: "합성 상담 기록 WDIO 006 수정 — 다음 단계 정리",
    nextContactOn: "2026-08-04",
    result: "합성 일정 조정",
  }),
});

export async function waitForConsultationSection() {
  const section = await $("[data-testid='consultation-section']");
  await section.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => !(await section.getAttribute("aria-busy")) ||
      (await section.getAttribute("aria-busy")) === "false",
    { timeout: 10_000, timeoutMsg: "consultation section did not settle" },
  );
  return section;
}

export async function visibleConsultationRows() {
  const rows = await $$('[data-testid="consultation-row"]');
  const visible = [];
  for (const row of rows) {
    if (await row.isDisplayed()) visible.push(row);
  }
  return visible;
}

export async function waitForConsultationCount(expected) {
  await browser.waitUntil(
    async () => (await visibleConsultationRows()).length === expected,
    { timeout: 10_000, timeoutMsg: `consultation row count did not become ${expected}` },
  );
  return visibleConsultationRows();
}

export async function consultationRowById(id) {
  const rows = await visibleConsultationRows();
  const matches = [];
  for (const row of rows) {
    if ((await row.getAttribute("data-consultation-id")) === id) matches.push(row);
  }
  if (matches.length !== 1) {
    throw new Error(`visible consultation row count for ID was ${matches.length}`);
  }
  return matches[0];
}

export async function createConsultation(input) {
  const before = new Set();
  for (const row of await visibleConsultationRows()) {
    before.add(await row.getAttribute("data-consultation-id"));
  }
  await $("[data-testid='create-consultation']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillConsultationForm(dialog, input);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });

  let createdId;
  await browser.waitUntil(
    async () => {
      for (const row of await visibleConsultationRows()) {
        const id = await row.getAttribute("data-consultation-id");
        if (id && !before.has(id)) {
          createdId = id;
          return true;
        }
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: "created consultation did not appear" },
  );
  if (!createdId) throw new Error("created consultation ID unavailable");
  return createdId;
}

export async function updateConsultation(id, input) {
  const row = await consultationRowById(id);
  await row.$("[data-testid='edit-consultation']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await fillConsultationForm(dialog, input);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await browser.waitUntil(
    async () => {
      try {
        const text = await (await consultationRowById(id)).getText();
        return (input.content === null || text.includes(input.content)) &&
          (input.result === null || text.includes(input.result));
      } catch {
        return false;
      }
    },
    { timeout: 10_000, timeoutMsg: "updated consultation did not settle" },
  );
  return consultationRowById(id);
}

export async function deleteConsultation(id) {
  const row = await consultationRowById(id);
  await row.$("[data-testid='delete-consultation']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("[data-testid='confirm-delete-consultation']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await browser.waitUntil(
    async () => {
      for (const candidate of await visibleConsultationRows()) {
        if ((await candidate.getAttribute("data-consultation-id")) === id) return false;
      }
      return true;
    },
    { timeout: 10_000, timeoutMsg: "deleted consultation remained visible" },
  );
}

export function utcForLocalDateTime(value) {
  return new Date(value).toISOString();
}

async function fillConsultationForm(dialog, input) {
  await dialog.$("input[name='consultedAt']").setValue(input.consultedAtLocal);
  await dialog.$("textarea[name='content']").setValue(input.content ?? "");
  await dialog.$("input[name='nextContactOn']").setValue(input.nextContactOn ?? "");
  await dialog.$("input[name='result']").setValue(input.result ?? "");
}
