/* global Event, document */

import { $, $$, browser, expect } from "@wdio/globals";

export const syntheticFamilies = Object.freeze({
  seedName: "합성 가족 WDIO 005",
  sharedName: "합성 가족 WDIO 005 수정",
  primaryRelationshipDraft: "합성 관계 A 초기",
  primaryRelationship: "합성 관계 A",
  secondaryRelationship: "합성 관계 B",
  reactivatedRelationship: "합성 관계 B 재등록",
});

const formattedWon = (value) =>
  `${new Intl.NumberFormat("ko-KR").format(BigInt(value))}원`;

export async function navigateToFamilies() {
  const link = await $("a[href='#/families']");
  await link.click();
  await waitForFamilyPage();
}

export async function waitForFamilyPage() {
  await $("[data-testid='create-family']").waitForDisplayed({ timeout: 10_000 });
}

export async function searchFamilies(value) {
  const search = await $("input[aria-label='가족 검색']");
  await search.setValue(value);
  await browser.pause(350);
  await browser.waitUntil(
    async () => !(await $(".refresh-state").isDisplayed()),
    { timeout: 10_000, timeoutMsg: "family search did not settle" },
  );
}

export async function familyRows() {
  return $$("[data-testid='family-row']");
}

export async function familyRowById(id) {
  const row = await $(`[data-testid='family-row'][data-family-id='${id}']`);
  await row.waitForDisplayed({ timeout: 10_000 });
  return row;
}

export async function createFamily(name, verifyValidation = false) {
  const existingIds = new Set();
  for (const row of await familyRows()) {
    existingIds.add(await row.getAttribute("data-family-id"));
  }
  const button = await $("[data-testid='create-family']");
  await button.click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  expect(await browser.execute(() => document.activeElement?.getAttribute("name"))).toBe("name");

  if (verifyValidation) {
    await dialog.$("button[type='submit']").click();
    expect(await dialog.getText()).toContain("가족 이름을 입력해 주세요");
    expect(await browser.execute(() => document.activeElement?.getAttribute("name"))).toBe("name");
  }

  await dialog.$("input[name='name']").setValue(name);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await searchFamilies(name);
  await browser.waitUntil(
    async () => {
      for (const row of await familyRows()) {
        const id = await row.getAttribute("data-family-id");
        if (id && !existingIds.has(id)) return true;
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: "new family row did not appear" },
  );
  for (const row of await familyRows()) {
    const id = await row.getAttribute("data-family-id");
    if (id && !existingIds.has(id)) return id;
  }
  throw new Error("new family id disappeared after wait");
}

export async function renameFamily(id, name) {
  const row = await familyRowById(id);
  await row.$("[data-testid='edit-family']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("input[name='name']").setValue(name);
  await dialog.$("button[type='submit']").click();
  await dialog.waitForDisplayed({ reverse: true });
  await searchFamilies(name);
  expect(await (await familyRowById(id)).getText()).toContain(name);
}

export async function waitForFamilySummary(id, memberCount, premium) {
  const expectedPremium = formattedWon(premium);
  await browser.waitUntil(
    async () => {
      const row = await $(`[data-testid='family-row'][data-family-id='${id}']`);
      if (!(await row.isDisplayed())) return false;
      const text = await row.getText();
      return text.includes(`${memberCount}명`) && text.includes(expectedPremium);
    },
    {
      timeout: 10_000,
      timeoutMsg: `family ${id} did not become ${memberCount} / ${expectedPremium}`,
    },
  );
  return familyRowById(id);
}

export async function findFamilyBySummary(name, memberCount, premium) {
  await searchFamilies(name);
  const expectedPremium = formattedWon(premium);
  await browser.waitUntil(
    async () => {
      for (const row of await familyRows()) {
        const text = await row.getText();
        if (text.includes(name) && text.includes(`${memberCount}명`) && text.includes(expectedPremium)) {
          return true;
        }
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: "family summary row was not found" },
  );
  for (const row of await familyRows()) {
    const text = await row.getText();
    if (text.includes(name) && text.includes(`${memberCount}명`) && text.includes(expectedPremium)) {
      return row;
    }
  }
  throw new Error("family summary row disappeared after wait");
}

export async function openFamilyMembers(id) {
  const row = await familyRowById(id);
  await row.$("[data-testid='manage-family-members']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("[data-testid='family-members-dialog']").waitForDisplayed();
  await dialog.$("[data-testid='family-member-list']").waitForDisplayed({ timeout: 10_000 });
  return dialog;
}

async function selectCustomer(dialog, customerName) {
  const select = await dialog.$("select[name='customerId']");
  const customerId = await browser.execute(
    (element, name) => {
      const option = Array.from(element.options)
        .find((candidate) => candidate.textContent?.includes(name));
      if (!option) return null;
      element.value = option.value;
      element.dispatchEvent(new Event("change", { bubbles: true }));
      return option.value;
    },
    select,
    customerName,
  );
  if (!customerId) throw new Error("synthetic family customer option was not found");
  expect(await select.getValue()).toBe(customerId);
  return customerId;
}

export async function waitForFamilyMember(dialog, customerName) {
  await dialog.$("[data-testid='family-member-list']").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => {
      for (const row of await dialog.$$("[data-testid='family-member-row']")) {
        if ((await row.getText()).includes(customerName)) return true;
      }
      return false;
    },
    { timeout: 10_000, timeoutMsg: `family member not found: ${customerName}` },
  );
  for (const row of await dialog.$$("[data-testid='family-member-row']")) {
    if ((await row.getText()).includes(customerName)) return row;
  }
  throw new Error("family member disappeared after wait");
}

export async function waitForFamilyMemberTotal(dialog, memberCount, premium) {
  const expectedPremium = formattedWon(premium);
  await browser.waitUntil(
    async () => {
      const list = await dialog.$("[data-testid='family-member-list']");
      if (!(await list.isDisplayed())) return false;
      const text = await list.getText();
      return text.includes(`활성 구성원 ${memberCount}명`) && text.includes(expectedPremium);
    },
    { timeout: 10_000, timeoutMsg: "family member total did not update" },
  );
}

export async function addFamilyMember(dialog, customerName, relationshipName) {
  await dialog.$("[data-testid='add-family-member']").click();
  const customerId = await selectCustomer(dialog, customerName);
  await dialog.$("input[name='relationshipName']").setValue(relationshipName);
  await dialog.$("button[type='submit']").click();
  const row = await waitForFamilyMember(dialog, customerName);
  expect(await row.getAttribute("data-customer-id")).toBe(customerId);
  return row;
}

export async function updateFamilyMember(dialog, row, relationshipName) {
  const customerName = await row.$("a").getText();
  await row.$("[data-testid='edit-family-member']").click();
  const input = await dialog.$("input[name='relationshipName']");
  await input.setValue(relationshipName);
  await dialog.$("button[type='submit']").click();
  const updated = await waitForFamilyMember(dialog, customerName);
  expect(await updated.getText()).toContain(relationshipName);
  return updated;
}

export async function removeFamilyMember(dialog, row) {
  const membershipId = await row.getAttribute("data-membership-id");
  await row.$("[data-testid='delete-family-member']").click();
  await dialog.$("[data-testid='family-member-delete']").waitForDisplayed();
  await dialog.$("button.is-danger").click();
  await dialog.$("[data-testid='family-member-list']").waitForDisplayed({ timeout: 10_000 });
  await browser.waitUntil(
    async () => !(await dialog
      .$(`[data-testid='family-member-row'][data-membership-id='${membershipId}']`)
      .isExisting()),
    { timeout: 10_000, timeoutMsg: "family membership row was not removed" },
  );
  return membershipId;
}

export async function closeFamilyMembers(dialog) {
  await dialog.$(".dialog-close").click();
  await dialog.waitForDisplayed({ reverse: true });
}

export async function deleteFamily(id) {
  const row = await familyRowById(id);
  await row.$("[data-testid='delete-family']").click();
  const dialog = await $("dialog[open]");
  await dialog.waitForDisplayed();
  await dialog.$("button.is-danger").click();
  await dialog.waitForDisplayed({ reverse: true });
  await browser.waitUntil(
    async () => !(await $(`[data-testid='family-row'][data-family-id='${id}']`).isExisting()),
    { timeout: 10_000, timeoutMsg: "family row was not removed" },
  );
  await browser.waitUntil(
    async () => (await browser.execute(
      () => document.activeElement?.getAttribute("aria-label"),
    )) === "가족 검색",
    { timeout: 10_000, timeoutMsg: "family deletion focus did not return to search" },
  );
}
