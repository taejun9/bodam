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

function port(
  overrides: Partial<ImportUiPort> = {},
): ImportUiPort {
  return {
    selectFile: vi.fn().mockResolvedValue(dataExchangeUiPreview()),
    commitImport: vi.fn().mockResolvedValue(dataExchangeUiResult),
    ...overrides,
  };
}

function mountWorkspace(importPort: ImportUiPort, nativeRuntime = true) {
  return mount(DataExchangeWorkspace, {
    attachTo: document.body,
    props: {
      nativeRuntime,
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

describe("DataExchangeWorkspace", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("keeps actual file selection desktop-only in Browser preview", async () => {
    const importPort = port();
    const wrapper = mountWorkspace(importPort, false);

    const select = wrapper.get("[data-testid='select-import-file']");
    expect(select.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Browser 미리보기에서는 실제 고객 파일을 열지 않습니다");
    expect(wrapper.get("[data-testid='data-risk-notice']").text()).toContain("전체 경로는 로그에 남기지");
    expect(wrapper.text()).toContain("최대 10 MiB");
    await select.trigger("click");
    expect(importPort.selectFile).not.toHaveBeenCalled();
  });

  it("renders validation, duplicate defaults, customer choices, and expandable 21-column raw text", async () => {
    const wrapper = mountWorkspace(port());
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    expect(wrapper.get("[data-testid='import-preview']").text())
      .toContain("synthetic-contracts-valid.xlsx");
    const table = wrapper.get("[data-testid='import-preview-table']");
    expect(table.findAll("[data-testid='import-row']")).toHaveLength(3);
    expect(desktopRow(4).getAttribute("data-row-state")).toBe("invalid");
    expect(desktopRow(4).querySelector<HTMLInputElement>("input[type='checkbox']")?.disabled)
      .toBe(true);

    const duplicateAction = desktopRow(3).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 3행 중복 처리']",
    )!;
    expect(duplicateAction.value).toBe("skip");
    expect([...duplicateAction.options].map((option) => option.value))
      .toEqual(["skip", "update", "separate-create"]);

    const customers = desktopRow(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    expect(customers.getAttribute("aria-invalid")).toBe("true");
    expect([...customers.options].map((option) => option.textContent))
      .toContain("합성 동명이인 (동명이인 1/2)");
    expect(wrapper.text()).not.toContain(dataExchangeUiIds.customerA);

    const detail = desktopRow(2).querySelector<HTMLButtonElement>(".detail-toggle")!;
    detail.click();
    await flushPromises();
    const sourceDetail = document.getElementById("import-source-detail-2")!;
    expect(sourceDetail.querySelectorAll("dt")).toHaveLength(21);
    expect(sourceDetail.textContent).toContain("00120000");
    expect(sourceDetail.textContent).toContain("00000000000000001-A");
    expect(sourceDetail.textContent).toContain("비어 있음");
  });

  it("focuses a valid preview and restores the stable selector after retry cancel", async () => {
    const cleanPreview = dataExchangeUiPreview();
    const importPort = port({
      selectFile: vi.fn()
        .mockResolvedValueOnce({
          ...cleanPreview,
          rows: cleanPreview.rows.filter((row) => row.issues.length === 0),
        })
        .mockRejectedValueOnce(new Error("unsafe detail"))
        .mockResolvedValueOnce(null),
    });
    const wrapper = mountWorkspace(importPort);

    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("[data-testid='import-preview']").element);

    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();
    const error = wrapper.get(".import-state.is-error");
    expect(document.activeElement).toBe(error.element);
    await error.get("button").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(wrapper.get("[data-testid='select-import-file']").element);
  });

  it("paginates large previews instead of rendering every source row twice", async () => {
    const preview = dataExchangeUiPreview();
    const baseRow = preview.rows[0]!;
    const rows = Array.from({ length: 51 }, (_, index) => ({
      ...baseRow,
      sourceRow: index + 2,
    }));
    const wrapper = mountWorkspace(port({
      selectFile: vi.fn().mockResolvedValue({ ...preview, rows }),
    }));
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const table = wrapper.get("[data-testid='import-preview-table']");
    expect(table.findAll("[data-testid='import-row']")).toHaveLength(50);
    expect(wrapper.text()).toContain("1 / 2 페이지");
    await wrapper.get("nav[aria-label='가져오기 행 페이지'] button:last-child")
      .trigger("click");
    expect(table.findAll("[data-testid='import-row']")).toHaveLength(1);
    expect(wrapper.text()).toContain("2 / 2 페이지");
  });

  it("commits explicit create and update decisions and focuses the result", async () => {
    const importPort = port();
    const wrapper = mountWorkspace(importPort);
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    const customer = desktopRow(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )!;
    customer.value = `existing:${dataExchangeUiIds.customerA}`;
    customer.dispatchEvent(new Event("change", { bubbles: true }));

    const action = desktopRow(3).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 3행 중복 처리']",
    )!;
    action.value = "update";
    action.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();

    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    expect(dialog.textContent).toContain("새 계약");
    expect(dialog.textContent).toContain("기존 계약 갱신");
    expect(document.activeElement?.textContent?.trim()).toBe("취소");

    dialog.querySelector<HTMLButtonElement>("[data-testid='confirm-import']")?.click();
    await flushPromises();

    expect(importPort.commitImport).toHaveBeenCalledOnce();
    const request = vi.mocked(importPort.commitImport).mock.calls[0]?.[0];
    expect(request?.previewId).toBe(dataExchangeUiIds.preview);
    expect(request?.rows).toHaveLength(2);
    expect(request?.rows[0]?.customer).toEqual({
      kind: "existing",
      customerId: dataExchangeUiIds.customerA,
    });
    expect(request?.rows[1]).toMatchObject({
      duplicateAction: "update",
      duplicateTargetPolicyId: dataExchangeUiIds.policy,
    });
    const result = wrapper.get("[data-testid='import-result']");
    expect(result.text()).toContain("계약 가져오기를 마쳤습니다");
    expect(document.activeElement).toBe(result.element);
    expect(wrapper.find("[data-testid='import-preview']").exists()).toBe(false);
  });

  it("creates a shared explicit customer definition without automatic prefilling", async () => {
    const importPort = port();
    const wrapper = mountWorkspace(importPort);
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    desktopRow(2).querySelector<HTMLButtonElement>("[data-new-customer-row='2']")?.click();
    await flushPromises();
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    const input = dialog.querySelector<HTMLInputElement>("input[name='newCustomerName']")!;
    expect(input.value).toBe("");
    expect(document.activeElement).toBe(input);
    const contractorCopy = [...dialog.querySelectorAll("button")]
      .find((button) => button.textContent?.includes("계약자"))!;
    contractorCopy.click();
    await flushPromises();
    expect(input.value).toBe("합성 계약자");
    dialog.querySelector<HTMLButtonElement>("button[type='submit']")?.click();
    await flushPromises();

    expect(wrapper.text()).toContain("이번 가져오기에 만들 고객 1명");
    expect(desktopRow(2).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 2행 연결 고객']",
    )?.value).toBe(`new:${dataExchangeUiIds.newCustomer}`);

    const action = desktopRow(3).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 3행 중복 처리']",
    )!;
    action.value = "separate-create";
    action.dispatchEvent(new Event("change", { bubbles: true }));
    await flushPromises();
    const duplicateCustomer = desktopRow(3).querySelector<HTMLSelectElement>(
      "select[aria-label='원본 3행 연결 고객']",
    )!;
    duplicateCustomer.value = `new:${dataExchangeUiIds.newCustomer}`;
    duplicateCustomer.dispatchEvent(new Event("change", { bubbles: true }));
    await wrapper.get("[data-testid='commit-import']").trigger("click");
    await flushPromises();
    document.body.querySelector<HTMLButtonElement>("[data-testid='confirm-import']")?.click();
    await flushPromises();

    const request = vi.mocked(importPort.commitImport).mock.calls[0]?.[0];
    expect(request?.newCustomers).toEqual([
      { clientKey: dataExchangeUiIds.newCustomer, name: "합성 계약자" },
    ]);
    expect(request?.rows[1]?.duplicateAction).toBe("separate-create");
  });

  it("accepts 4,000 scalar customer names and rejects longer names", async () => {
    const importPort = port();
    const wrapper = mountWorkspace(importPort);
    await wrapper.get("[data-testid='select-import-file']").trigger("click");
    await flushPromises();

    desktopRow(2).querySelector<HTMLButtonElement>("[data-new-customer-row='2']")?.click();
    await flushPromises();
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog[open]")!;
    const input = dialog.querySelector<HTMLInputElement>("input[name='newCustomerName']")!;
    input.value = "가".repeat(4_001);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>("button[type='submit']")?.click();
    await flushPromises();
    expect(dialog.textContent).toContain("고객 이름은 4,000자 이내로 입력해 주세요.");

    input.value = "가".repeat(4_000);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    dialog.querySelector<HTMLButtonElement>("button[type='submit']")?.click();
    await flushPromises();
    expect(document.body.querySelector<HTMLDialogElement>("dialog[open]")).toBeNull();
  });
});
