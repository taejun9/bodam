import { realpathSync } from "node:fs";
import { basename, dirname, isAbsolute, relative, resolve } from "node:path";
import process from "node:process";

import { $, browser, expect } from "@wdio/globals";

import {
  createCustomer,
  customerRows,
  removeCustomer,
  searchCustomers,
} from "./customer.fixture.mjs";

export const snapshotSettings = Object.freeze({
  theme: "dark",
  recentConsultationDays: "7",
  unconsultedDays: "40",
  dashboardItemLimit: "1",
});

export const mutatedSettings = Object.freeze({
  theme: "light",
  recentConsultationDays: "21",
  unconsultedDays: "60",
  dashboardItemLimit: "3",
});

export const backupCustomers = Object.freeze({
  snapshot: Object.freeze({
    name: "합성 백업 기준 고객 WDIO 012",
    phone: "010-0000-0012",
    status: "합성 복원 기준",
  }),
  mutation: Object.freeze({
    name: "합성 백업 이후 고객 WDIO 012",
    phone: "010-0000-0013",
    status: "합성 복원 제거 대상",
  }),
  exitFailure: Object.freeze({
    name: "합성 종료 실패 보존 고객 WDIO 012",
    phone: "010-0000-0014",
    status: "합성 경고 종료 보존",
  }),
  exitChanged: Object.freeze({
    name: "합성 변경 종료 고객 WDIO 012",
    phone: "010-0000-0015",
    status: "합성 종료 백업 대상",
  }),
});

function isContained(parent, child) {
  const childRelative = relative(resolve(parent), resolve(child));
  return childRelative !== "" && childRelative !== ".." &&
    !childRelative.startsWith(`..${process.platform === "win32" ? "\\" : "/"}`) &&
    !isAbsolute(childRelative);
}

export function backupEnvironment({ restoreRequired = false } = {}) {
  const databasePath = process.env.BODAM_E2E_DB_PATH;
  const backupDirectory = process.env.BODAM_E2E_BACKUP_DIRECTORY;
  const restoreFile = process.env.BODAM_E2E_RESTORE_FILE;
  if (!databasePath || !isAbsolute(databasePath) || !databasePath.endsWith(".sqlite3")) {
    throw new Error("backup E2E database path is invalid");
  }
  if (!backupDirectory || !isAbsolute(backupDirectory) ||
      !isContained(dirname(databasePath), backupDirectory)) {
    throw new Error("backup E2E directory must be inside the temporary database root");
  }
  if (restoreRequired && (!restoreFile || !isAbsolute(restoreFile) ||
      !restoreFile.endsWith(".bodam-backup") ||
      !isContained(backupDirectory, restoreFile))) {
    throw new Error("restore E2E file must be inside the temporary backup directory");
  }
  return { databasePath, backupDirectory, restoreFile };
}

export async function waitForNativeShell() {
  const body = await $("body");
  await body.waitForExist({ timeout: 15_000 });
  const settingsLink = await $("a[href='#/settings']");
  await settingsLink.waitForDisplayed({ timeout: 15_000 });
  const isTauri = await browser.execute(() => "__TAURI_INTERNALS__" in globalThis);
  expect(isTauri).toBe(true);
}

export async function navigateToSettings() {
  await waitForNativeShell();
  await $("a[href='#/settings']").click();
  const section = await $("[data-testid='app-settings-section']");
  await section.waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => (await section.getAttribute("aria-busy")) === "false",
    { timeout: 15_000, timeoutMsg: "app settings did not finish loading" },
  );
  const status = await $("[data-testid='backup-status']");
  await status.waitForDisplayed({ timeout: 15_000 });
  return { section, status };
}

export async function navigateToCustomers() {
  await waitForNativeShell();
  await $("a[href='#/customers']").click();
  const createButton = await $("[data-testid='create-customer']");
  await createButton.waitForDisplayed({ timeout: 10_000 });
}

export async function removeSyntheticCustomer(name) {
  await navigateToCustomers();
  await searchCustomers(name);
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const rows = await customerRows();
    const row = await findRow(rows, name);
    if (!row) return;
    await removeCustomer(row);
    await searchCustomers(name);
  }
  throw new Error(`synthetic customer cleanup did not finish: ${name}`);
}

export async function createSyntheticCustomer(customer) {
  await removeSyntheticCustomer(customer.name);
  await createCustomer(customer);
}

export async function expectSyntheticCustomer(name, present) {
  await navigateToCustomers();
  await searchCustomers(name);
  const row = await findRow(await customerRows(), name);
  if (present) expect(row).toBeDefined();
  else expect(row).toBeUndefined();
}

async function findRow(rows, name) {
  for (const row of rows) {
    if ((await row.getText()).includes(name)) return row;
  }
  return undefined;
}

export async function saveSettings(section, settings) {
  await section.$(`input[name='theme'][value='${settings.theme}']`).click();
  for (const field of [
    "recentConsultationDays",
    "unconsultedDays",
    "dashboardItemLimit",
  ]) {
    await section.$(`input[name='${field}']`).setValue(settings[field]);
  }
  await section.$("button[type='submit']").click();
  const notice = await section.$(".app-settings-result");
  await notice.waitForDisplayed({ timeout: 10_000 });
  expect(await notice.getText()).toContain("설정");
  await expectSettings(section, settings);
}

export async function expectSettings(section, settings) {
  expect(await section.$(
    `input[name='theme'][value='${settings.theme}']`,
  ).isSelected()).toBe(true);
  for (const field of [
    "recentConsultationDays",
    "unconsultedDays",
    "dashboardItemLimit",
  ]) {
    expect(await section.$(`input[name='${field}']`).getValue()).toBe(settings[field]);
  }
  const theme = await browser.execute(
    () => globalThis.document.documentElement.dataset.theme,
  );
  expect(theme).toBe(settings.theme);
}

export async function expectDashboardSettings(settings) {
  await $("a[href='#/dashboard']").click();
  const grid = await $("[data-testid='dashboard-grid']");
  await grid.waitForDisplayed({ timeout: 15_000 });
  expect(await grid.$("[data-dashboard-metric='recent-consultation']").getText())
    .toContain(`최근 ${settings.recentConsultationDays}일`);
  expect(await grid.$("[data-dashboard-metric='unconsulted']").getText())
    .toContain(`${settings.unconsultedDays}일 이상`);
}

export function automaticCount(statusText) {
  const match = statusText.match(/자동 백업\s*(\d+)\s*\/\s*30/);
  if (!match) throw new Error(`automatic backup count is unavailable: ${statusText}`);
  return Number(match[1]);
}

export function expectPathless(text, expectedBasename) {
  const { databasePath, backupDirectory, restoreFile } = backupEnvironment();
  const privatePaths = new Set([
    databasePath,
    dirname(databasePath),
    backupDirectory,
    restoreFile ? dirname(restoreFile) : undefined,
  ]);
  for (const privatePath of [...privatePaths]) {
    if (!privatePath) continue;
    try { privatePaths.add(realpathSync(privatePath)); } catch {
      // A parent path is still checked when an optional file is not present yet.
    }
  }
  for (const privatePath of privatePaths) {
    if (privatePath) expect(text).not.toContain(privatePath);
  }
  if (expectedBasename) {
    expect(text).toContain(expectedBasename);
    expect(expectedBasename).toBe(basename(expectedBasename));
    expect(text).not.toContain(`/${expectedBasename}`);
    expect(text).not.toContain(`\\${expectedBasename}`);
  }
}

export async function invokeBackup(command, args = {}) {
  return browser.tauri.execute(
    ({ core }, commandName, payload) => core.invoke(commandName, payload),
    command,
    args,
  );
}

export async function checkDailyWhenReady() {
  let busyFailure;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      return await invokeBackup("check_daily_backup");
    } catch (error) {
      if (!isBackupBusy(error)) throw error;
      busyFailure = error;
      if (attempt < 39) await browser.pause(250);
    }
  }
  throw busyFailure;
}

function isBackupBusy(error) {
  const safeBusyMessage = "다른 백업 또는 복원 작업이 진행 중입니다.";
  const values = [
    typeof error === "string" ? error : undefined,
    error instanceof Error ? error.message : undefined,
  ];
  try { values.push(JSON.stringify(error)); } catch {
    // The exact top-level error string and message remain authoritative.
  }
  return values.some((value) =>
    value?.includes("BACKUP_OPERATION_BUSY") || value?.includes(safeBusyMessage)
  );
}

export async function closeNativeWindow() {
  const label = await browser.execute(
    () => globalThis.__TAURI_INTERNALS__?.metadata?.currentWindow?.label,
  );
  if (typeof label !== "string" || label.length === 0) {
    throw new Error("Tauri current window label is unavailable");
  }
  return invokeBackup("plugin:window|close", { label });
}

export function isExpectedSessionEnd(error) {
  const message = error instanceof Error ? `${error.name}: ${error.message}` : String(error);
  return /ECONNREFUSED|ECONNRESET|UND_ERR_SOCKET|connection (?:was )?(?:closed|reset)|disconnected|invalid session|session deleted|no such window|socket hang up|terminated/i
    .test(message);
}

export async function expectSessionEnd(operation, timeout = 45_000) {
  try {
    await operation();
  } catch (error) {
    if (isExpectedSessionEnd(error)) return;
    throw error;
  }
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    try {
      await browser.getTitle();
      await browser.pause(250);
    } catch (error) {
      if (isExpectedSessionEnd(error)) return;
      throw error;
    }
  }
  throw new Error("native app did not end the WebDriver session");
}
