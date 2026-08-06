import { describe, expect, it, vi } from "vitest";

import { ContractExportApplication } from "../application/contract-export-application";
import type { ContractExportRepository } from "../repositories/contract-export-repository";
import type {
  ContractExportResult,
  ContractExportSummary,
} from "../types/contract-export";

const summary = (overrides: Partial<ContractExportSummary> = {}): ContractExportSummary => ({
  exportableCount: 2,
  missingSourceCount: 1,
  conflictCount: 1,
  csvAllowed: true,
  ...overrides,
});

const result = (format: "xlsx" | "csv" = "xlsx"): ContractExportResult => ({
  basename: `BODAM-contracts-synthetic.${format}`,
  format,
  exportedCount: 2,
  missingSourceCount: 1,
  conflictCount: 1,
});

function dependencies(summaryValue = summary()) {
  const repository: ContractExportRepository = {
    loadSummary: vi.fn().mockResolvedValue(summaryValue),
    save: vi.fn().mockImplementation((format) => Promise.resolve(result(format))),
  };
  return {
    application: new ContractExportApplication(repository),
    repository,
  };
}

describe("ContractExportApplication", () => {
  it("requires a current strict summary and returns a strict completed result", async () => {
    const { application, repository } = dependencies();

    await expect(application.save("xlsx")).rejects.toMatchObject({
      code: "invalid_selection",
    });
    await expect(application.loadSummary()).resolves.toEqual({
      status: "ready",
      summary: summary(),
    });
    await expect(application.save("csv")).resolves.toEqual({
      status: "completed",
      result: result("csv"),
    });
    expect(repository.save).toHaveBeenCalledWith("csv");
  });

  it("fails closed before the dialog for zero rows and unsafe CSV", async () => {
    const empty = dependencies(summary({ exportableCount: 0 }));
    await empty.application.loadSummary();
    await expect(empty.application.save("xlsx")).rejects.toMatchObject({ code: "no_data" });
    expect(empty.repository.save).not.toHaveBeenCalled();

    const blocked = dependencies(summary({ csvAllowed: false }));
    await blocked.application.loadSummary();
    await expect(blocked.application.save("csv")).rejects.toMatchObject({
      code: "csv_blocked",
    });
    expect(blocked.repository.save).not.toHaveBeenCalled();
  });

  it("invalidates a cached summary when its refresh fails", async () => {
    const { application, repository } = dependencies();
    await application.loadSummary();
    vi.mocked(repository.loadSummary).mockRejectedValueOnce(new Error("private-summary"));

    await expect(application.loadSummary()).rejects.toMatchObject({
      message: "내보낼 계약 건수를 불러오지 못했습니다. 다시 시도해 주세요.",
    });
    await expect(application.save("xlsx")).rejects.toMatchObject({
      code: "invalid_selection",
    });
    expect(repository.save).not.toHaveBeenCalled();
  });

  it("distinguishes native cancellation from a completed save", async () => {
    const { application, repository } = dependencies();
    vi.mocked(repository.save).mockResolvedValueOnce(null);
    await application.loadSummary();

    await expect(application.save("xlsx")).resolves.toEqual({ status: "cancelled" });
  });

  it("suppresses an older summary and an export cleared while pending", async () => {
    const { application, repository } = dependencies();
    const olderSummary = deferred<ContractExportSummary>();
    vi.mocked(repository.loadSummary)
      .mockImplementationOnce(() => olderSummary.promise)
      .mockResolvedValueOnce(summary({ exportableCount: 3 }));

    const older = application.loadSummary();
    await expect(application.loadSummary()).resolves.toMatchObject({
      status: "ready",
      summary: { exportableCount: 3 },
    });
    olderSummary.resolve(summary());
    await expect(older).resolves.toEqual({ status: "stale" });

    const pendingSave = deferred<ContractExportResult | null>();
    vi.mocked(repository.save).mockImplementationOnce(() => pendingSave.promise);
    const save = application.save("xlsx");
    await expect(application.save("xlsx")).rejects.toMatchObject({ code: "busy" });
    application.clear();
    pendingSave.resolve(result());
    await expect(save).resolves.toEqual({ status: "stale" });
  });

  it("redacts unknown failures and rejects a mismatched native result format", async () => {
    const { application, repository } = dependencies();
    await application.loadSummary();
    vi.mocked(repository.save).mockRejectedValueOnce(new Error("private-source-marker"));
    const unknown = await application.save("xlsx").catch((caught: unknown) => caught);
    expect(unknown).toMatchObject({
      message: "계약 파일을 저장하지 못했습니다. 다시 시도해 주세요.",
    });
    expect(String(unknown)).not.toContain("private-source-marker");

    vi.mocked(repository.save).mockResolvedValueOnce(result("csv"));
    await expect(application.save("xlsx")).rejects.toMatchObject({
      code: "invalid_response",
    });
  });
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}
