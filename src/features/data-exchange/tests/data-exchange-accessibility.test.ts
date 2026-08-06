// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import DataExchangeWorkspace from "../components/DataExchangeWorkspace.vue";
import type { ImportUiPort } from "../components/data-exchange-ui";
import {
  dataExchangeUiIds,
  dataExchangeUiPreview,
  dataExchangeUiResult,
} from "./data-exchange-ui-test-data";

function mountWorkspace(importPort: ImportUiPort) {
  return mount(DataExchangeWorkspace, {
    attachTo: document.body,
    props: {
      nativeRuntime: true,
      port: importPort,
      createClientKey: () => dataExchangeUiIds.newCustomer,
    },
  });
}

function row(sourceRow: number): HTMLElement {
  return document.body.querySelector(
    `[data-testid='import-preview-table'] [data-source-row='${sourceRow}']`,
  )!;
}

describe("data exchange error and focus contracts", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("focuses a safe file alert without echoing unknown error content", async () => {
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockRejectedValue(new Error("private-cell-marker")),
      commitImport: vi.fn(),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const alert = document.body.querySelector<HTMLElement>(".import-state[role='alert']")!;
    expect(alert.textContent).toContain("형식과 크기를 확인");
    expect(alert.textContent).not.toContain("private-cell-marker");
    expect(document.activeElement).toBe(alert);
  });

  it("does not trust a userMessage field on an unknown rejected value", async () => {
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockRejectedValue({
        userMessage: "private-object-marker",
      }),
      commitImport: vi.fn(),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const alert = document.body.querySelector<HTMLElement>(".import-state[role='alert']")!;
    expect(alert.textContent).toContain("형식과 크기를 확인");
    expect(alert.textContent).not.toContain("private-object-marker");
  });

  it("moves focus to the first incomplete customer decision", async () => {
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();

    const customer = row(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    expect(wrapper.text()).toContain("2행의 고객 또는 중복 처리 결정을 완료");
    expect(customer.getAttribute("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(customer);
    expect(document.body.querySelector("dialog[open]")).toBeNull();
  });

  it("keeps commit failure inside the confirmation dialog with a safe message", async () => {
    const rejected = new Error("중복 상태가 바뀌었습니다. 파일을 다시 확인해 주세요.");
    rejected.name = "DataExchangeApplicationError";
    const commitImport = vi.fn().mockRejectedValue(rejected);
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport,
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    const customer = row(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    customer.value = `existing:${dataExchangeUiIds.customerA}`;
    customer.dispatchEvent(new Event("change", { bubbles: true }));
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>("[data-testid='confirm-import']")?.click();
    await flushPromises();

    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(dialog).not.toBeNull();
    expect(dialog.querySelector("[role='alert']")?.textContent)
      .toContain("중복 상태가 바뀌었습니다");
    expect(wrapper.find("[data-testid='import-result']").exists()).toBe(false);
  });

  it("discards a conflicted preview and focuses the safe reselect state", async () => {
    const conflict = Object.assign(
      new Error("데이터가 변경되었습니다. 파일을 다시 확인해 주세요."),
      { name: "DataExchangeError", code: "conflict" },
    );
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport: vi.fn().mockRejectedValue(conflict),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    const customer = row(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    customer.value = `existing:${dataExchangeUiIds.customerA}`;
    customer.dispatchEvent(new Event("change", { bubbles: true }));
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>("[data-testid='confirm-import']")?.click();
    await flushPromises();

    const alert = document.body.querySelector<HTMLElement>(".import-state[role='alert']")!;
    expect(alert.textContent).toContain("데이터가 변경되었습니다");
    expect(document.activeElement).toBe(alert);
    expect(wrapper.find("[data-testid='import-preview']").exists()).toBe(false);
    expect(document.body.querySelector("dialog[open]")).toBeNull();
  });

  it("closes the new-customer dialog on Escape and returns focus to its row trigger", async () => {
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    const trigger = row(2).querySelector<HTMLButtonElement>("[data-new-customer-row='2']")!;
    trigger.focus();
    trigger.click();
    await flushPromises();
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(document.activeElement)
      .toBe(dialog.querySelector("input[name='newCustomerName']"));

    dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("renders a dedicated card view for 390px without exposing a page-sized fixed width", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: true,
      media: "(max-width: 720px)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    });
    Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const cards = wrapper.get("[data-testid='import-preview-cards']");
    expect(cards.findAll("[data-testid='import-row']")).toHaveLength(3);
    expect(cards.find("[data-source-row='2'] .card-detail-toggle").attributes("aria-expanded"))
      .toBe("false");
    expect(wrapper.get("[data-testid='data-exchange-workspace']").attributes("style"))
      .toBeUndefined();
  });
});
