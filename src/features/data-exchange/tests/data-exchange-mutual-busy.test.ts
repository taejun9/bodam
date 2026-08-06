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

function importPort(overrides: Partial<ImportUiPort> = {}): ImportUiPort {
  return {
    selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
    commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    ...overrides,
  };
}

function row(sourceRow: number): HTMLElement {
  return document.body.querySelector(
    `[data-testid='import-preview-table'] [data-source-row='${sourceRow}']`,
  )!;
}

describe("data exchange mutual operation lock", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("disables import actions while export is busy", async () => {
    const port = importPort();
    const wrapper = mount(DataExchangeWorkspace, {
      attachTo: document.body,
      props: {
        nativeRuntime: true,
        externalBusy: true,
        port,
        createClientKey: () => dataExchangeUiIds.newCustomer,
      },
    });

    const select = wrapper.get("[data-testid='select-import-file']");
    expect(select.attributes("disabled")).toBeDefined();
    await select.trigger("click");
    expect(port.selectFile).not.toHaveBeenCalled();

    await wrapper.setProps({ externalBusy: false });
    await select.trigger("click");
    await flushPromises();
    await wrapper.setProps({ externalBusy: true });
    expect(wrapper.get("[data-testid='commit-import']").attributes("disabled"))
      .toBeDefined();
  });

  it("marks file selection and every open import dialog as busy for export", async () => {
    const pending = deferred<ReturnType<typeof dataExchangeUiPreview>>();
    const port = importPort({ selectFile: vi.fn().mockReturnValueOnce(pending.promise) });
    const wrapper = mount(DataExchangeWorkspace, {
      attachTo: document.body,
      props: {
        nativeRuntime: true,
        port,
        createClientKey: () => dataExchangeUiIds.newCustomer,
      },
    });

    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    expect(wrapper.emitted("busyChange")?.at(-1)).toEqual([true]);
    pending.resolve(dataExchangeUiPreview());
    await flushPromises();
    expect(wrapper.emitted("busyChange")?.at(-1)).toEqual([false]);

    row(2).querySelector<HTMLButtonElement>("[data-new-customer-row='2']")?.click();
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).not.toBeNull();
    expect(wrapper.emitted("busyChange")?.at(-1)).toEqual([true]);
    document.body.querySelector<HTMLButtonElement>(".dialog-close")?.click();
    await flushPromises();
    expect(wrapper.emitted("busyChange")?.at(-1)).toEqual([false]);

    const customer = row(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    customer.value = `existing:${dataExchangeUiIds.customerA}`;
    customer.dispatchEvent(new Event("change", { bubbles: true }));
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    expect(document.body.querySelector("dialog[open]")).not.toBeNull();
    expect(wrapper.emitted("busyChange")?.at(-1)).toEqual([true]);
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
