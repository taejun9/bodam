// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import DataExchangeWorkspace from "../components/DataExchangeWorkspace.vue";
import type {
  ImportUiPort,
  ImportUiResult,
} from "../components/data-exchange-ui";
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

function desktopRow(sourceRow: number): HTMLElement {
  return document.body.querySelector(
    `[data-testid='import-preview-table'] [data-source-row='${sourceRow}']`,
  )!;
}

describe("data exchange UI regressions", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("keeps every dismiss path closed while an atomic commit is pending", async () => {
    const pending = deferred<ImportUiResult>();
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
      commitImport: vi.fn().mockReturnValue(pending.promise),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const customer = desktopRow(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    customer.value = `existing:${dataExchangeUiIds.customerA}`;
    customer.dispatchEvent(new Event("change", { bubbles: true }));
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();

    let dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    const descriptionId = dialog.getAttribute("aria-describedby");
    expect(descriptionId).toBeTruthy();
    expect(document.getElementById(descriptionId!)?.textContent).toContain("하나의 작업");
    const initialCancel = [...dialog.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "취소")!;
    expect(initialCancel.disabled).toBe(false);
    initialCancel.click();
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).toBeNull();

    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    dialog.querySelector<HTMLButtonElement>("[data-testid='confirm-import']")?.click();
    await flushPromises();
    const cancel = [...dialog.querySelectorAll<HTMLButtonElement>("button")]
      .find((button) => button.textContent?.trim() === "취소")!;
    expect(cancel.disabled).toBe(true);
    expect(dialog.getAttribute("aria-busy")).toBe("true");
    expect(dialog.querySelector<HTMLButtonElement>(".dialog-close")?.disabled).toBe(true);

    dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).toBe(dialog);

    dialog.querySelector<HTMLButtonElement>(".dialog-close")?.click();
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).toBe(dialog);

    dialog.dispatchEvent(new MouseEvent("click", {
      bubbles: true,
      clientX: 10_000,
      clientY: 10_000,
    }));
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).toBe(dialog);

    pending.resolve(dataExchangeUiResult);
    await flushPromises();
    expect(wrapper.find("[data-testid='import-result']").exists()).toBe(true);
  });

  it("wraps allowed 4,000-scalar customer and reference names in bounded elements", async () => {
    const longName = "A".repeat(4_000);
    const basePreview = dataExchangeUiPreview();
    const preview = {
      ...basePreview,
      rows: basePreview.rows.map((row) => row.sourceRow === 2
        ? {
            ...row,
            source: {
              ...row.source,
              contractor: longName,
              insured: longName,
            },
          }
        : row),
    };
    const wrapper = mountWorkspace({
      selectFile: vi.fn().mockResolvedValue(preview),
      commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    });
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    desktopRow(2).querySelector<HTMLButtonElement>("[data-new-customer-row='2']")?.click();
    await flushPromises();
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    const references = [...dialog.querySelectorAll<HTMLElement>(".reference-value")];
    expect(references).toHaveLength(2);
    expect(references.every((item) => item.textContent === longName)).toBe(true);

    const input = dialog.querySelector<HTMLInputElement>("input[name='newCustomerName']")!;
    input.value = longName;
    input.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>("button[type='submit']")?.click();
    await flushPromises();

    const chip = wrapper.get(".new-customer-name");
    expect(chip.text().trim()).toBe(longName);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
