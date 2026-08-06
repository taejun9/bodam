// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import ContractExportPanel from "../components/ContractExportPanel.vue";
import type { ContractExportUiPort } from "../components/contract-export-ui";
import type { ContractExportResult } from "../types/contract-export";

const summary = {
  exportableCount: 2,
  missingSourceCount: 1,
  conflictCount: 3,
  csvAllowed: true,
};

const result: ContractExportResult = {
  basename: "BODAM-contracts-synthetic.xlsx",
  format: "xlsx",
  exportedCount: 2,
  missingSourceCount: 1,
  conflictCount: 3,
};

function port(overrides: Partial<ContractExportUiPort> = {}): ContractExportUiPort {
  return {
    loadSummary: vi.fn().mockResolvedValue({ status: "ready", summary }),
    save: vi.fn().mockResolvedValue({ status: "completed", result }),
    clear: vi.fn(),
    ...overrides,
  };
}

function mountPanel(
  exportPort: ContractExportUiPort,
  nativeRuntime = true,
  externalBusy = false,
) {
  return mount(ContractExportPanel, {
    attachTo: document.body,
    props: { nativeRuntime, externalBusy, port: exportPort },
  });
}

describe("ContractExportPanel", () => {
  afterEach(() => {
    document.body.replaceChildren();
    vi.restoreAllMocks();
  });

  it("does not invoke Tauri in Browser preview and explains the disabled state", async () => {
    const exportPort = port();
    const wrapper = mountPanel(exportPort, false);
    await flushPromises();

    expect(exportPort.loadSummary).not.toHaveBeenCalled();
    expect(wrapper.get("[data-testid='export-xlsx']").attributes("disabled")).toBeDefined();
    expect(wrapper.get("[data-testid='export-csv']").attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("Browser 미리보기에서는 실제 파일을 저장하지 않습니다");
    expect(wrapper.text()).toContain("암호화되지 않은 민감정보 평문");
    expect(wrapper.text()).toContain("같은 디스크");
  });

  it("loads exact target counts and blocks unsafe CSV without hiding exclusions", async () => {
    const exportPort = port({
      loadSummary: vi.fn().mockResolvedValue({
        status: "ready",
        summary: { ...summary, csvAllowed: false },
      }),
    });
    const wrapper = mountPanel(exportPort);
    await flushPromises();

    expect(exportPort.loadSummary).toHaveBeenCalledOnce();
    expect(wrapper.get("[data-export-summary='exported']").text()).toContain("2");
    expect(wrapper.get("[data-export-summary='missingSource']").text()).toContain("1");
    expect(wrapper.get("[data-export-summary='sourceConflict']").text()).toContain("3");
    expect(wrapper.get("[data-testid='export-xlsx']").attributes("disabled")).toBeUndefined();
    expect(wrapper.get("[data-testid='export-csv']").attributes("disabled")).toBeDefined();
    expect(wrapper.get("#export-csv-note").text()).toContain("CSV는 차단했습니다");
  });

  it("keeps cancellation distinct and restores the triggering button focus", async () => {
    const pending = deferred<{ status: "cancelled" }>();
    const exportPort = port({ save: vi.fn().mockReturnValue(pending.promise) });
    const wrapper = mountPanel(exportPort);
    await flushPromises();
    const trigger = wrapper.get<HTMLButtonElement>("[data-testid='export-xlsx']");
    trigger.element.focus();
    await trigger.trigger("click");
    await flushPromises();

    expect(wrapper.get("[data-testid='contract-export-panel']").attributes("aria-busy"))
      .toBe("true");
    expect(wrapper.get("[data-testid='export-csv']").attributes("disabled")).toBeDefined();
    pending.resolve({ status: "cancelled" });
    await flushPromises();

    expect(wrapper.text()).toContain("저장을 취소했습니다");
    expect(wrapper.find("[data-testid='export-result']").exists()).toBe(false);
    expect(document.activeElement).toBe(trigger.element);
  });

  it("focuses a pathless success and preserves it if summary refresh fails", async () => {
    const exportPort = port({
      loadSummary: vi.fn()
        .mockResolvedValueOnce({ status: "ready", summary })
        .mockRejectedValueOnce(new Error("private-summary-marker")),
    });
    const wrapper = mountPanel(exportPort);
    await flushPromises();
    await wrapper.get("[data-testid='export-xlsx']").trigger("click");
    await flushPromises();

    const success = wrapper.get("[data-testid='export-result']");
    expect(success.text()).toContain("BODAM-contracts-synthetic.xlsx");
    expect(success.text()).not.toContain("/");
    expect(success.get("[data-export-count='exported']").text()).toContain("2");
    expect(success.get("[data-export-count='missingSource']").text()).toContain("1");
    expect(success.get("[data-export-count='sourceConflict']").text()).toContain("3");
    expect(document.activeElement).toBe(success.element);
    expect(wrapper.text()).not.toContain("private-summary-marker");
    expect(wrapper.get("[role='alert']").text()).toContain("건수를 불러오지 못했습니다");
    expect(wrapper.get("[data-testid='export-xlsx']").attributes("disabled")).toBeDefined();
    expect(wrapper.get("[data-export-summary='exported']").text()).toContain("—");
  });

  it("keeps summary retry locked during import and restores focus after success", async () => {
    const exportPort = port({
      loadSummary: vi.fn()
        .mockRejectedValueOnce(new Error("initial summary failure"))
        .mockResolvedValueOnce({ status: "ready", summary }),
    });
    const wrapper = mountPanel(exportPort);
    await flushPromises();

    const retry = wrapper.get<HTMLButtonElement>("[role='alert'] button");
    expect(wrapper.get("[data-export-summary='exported']").text()).toContain("—");
    await wrapper.setProps({ externalBusy: true });
    expect(retry.attributes("disabled")).toBeDefined();
    await retry.trigger("click");
    expect(exportPort.loadSummary).toHaveBeenCalledOnce();

    await wrapper.setProps({ externalBusy: false });
    await retry.trigger("click");
    await flushPromises();

    expect(exportPort.loadSummary).toHaveBeenCalledTimes(2);
    expect(wrapper.find("[role='alert']").exists()).toBe(false);
    expect(wrapper.get("[data-export-summary='exported']").text()).toContain("2");
    expect(document.activeElement).toBe(
      wrapper.get<HTMLButtonElement>("[data-testid='export-xlsx']").element,
    );
  });

  it("shows a fixed retryable error and disables export during an import operation", async () => {
    const forged = new Error("private-source-marker");
    forged.name = "ContractExportRepositoryError";
    const exportPort = port({
      save: vi.fn().mockRejectedValue(forged),
    });
    const wrapper = mountPanel(exportPort);
    await flushPromises();
    await wrapper.setProps({ externalBusy: true });
    expect(wrapper.get("[data-testid='export-xlsx']").attributes("disabled")).toBeDefined();
    await wrapper.setProps({ externalBusy: false });
    await wrapper.get("[data-testid='export-xlsx']").trigger("click");
    await flushPromises();

    const alert = wrapper.get("[role='alert']");
    expect(alert.text()).toContain("계약 파일을 저장하지 못했습니다");
    expect(alert.text()).not.toContain("private-source-marker");
    expect(document.activeElement).toBe(alert.element);
    expect(alert.get("button").text()).toContain("XLSX 저장 다시 시도");
  });

  it("locks save retry during import and restores format focus after retry cancellation", async () => {
    const exportPort = port({
      save: vi.fn()
        .mockRejectedValueOnce(new Error("first save failed"))
        .mockResolvedValueOnce({ status: "cancelled" }),
    });
    const wrapper = mountPanel(exportPort);
    await flushPromises();
    await wrapper.get("[data-testid='export-xlsx']").trigger("click");
    await flushPromises();

    await wrapper.setProps({ externalBusy: true });
    const retry = wrapper.get<HTMLButtonElement>("[role='alert'] button");
    expect(retry.attributes("disabled")).toBeDefined();
    await retry.trigger("click");
    expect(exportPort.save).toHaveBeenCalledOnce();

    await wrapper.setProps({ externalBusy: false });
    await retry.trigger("click");
    await flushPromises();

    expect(exportPort.save).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).toContain("저장을 취소했습니다");
    expect(document.activeElement).toBe(
      wrapper.get<HTMLButtonElement>("[data-testid='export-xlsx']").element,
    );
  });

  it("clears the application boundary when a pending route is unmounted", async () => {
    const pending = deferred<{ status: "stale" }>();
    const exportPort = port({ save: vi.fn().mockReturnValue(pending.promise) });
    const wrapper = mountPanel(exportPort);
    await flushPromises();
    await wrapper.get("[data-testid='export-xlsx']").trigger("click");
    await flushPromises();

    wrapper.unmount();
    expect(exportPort.clear).toHaveBeenCalledOnce();
    pending.resolve({ status: "stale" });
    await flushPromises();
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
