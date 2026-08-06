import { describe, expect, it } from "vitest";

import {
  TauriContractExportRepository,
  type ContractExportInvoke,
} from "../repositories/tauri-contract-export-repository";
import { contractExportSafeMessage } from "../types/contract-export-error";

const summary = {
  exportableCount: 2,
  missingSourceCount: 1,
  conflictCount: 1,
  csvAllowed: true,
};

const result = {
  basename: "BODAM-contracts-synthetic.xlsx",
  format: "xlsx" as const,
  exportedCount: 2,
  missingSourceCount: 1,
  conflictCount: 1,
};

describe("TauriContractExportRepository", () => {
  it("uses only the pathless summary and save command contracts", async () => {
    const calls: Array<{ command: string; args?: Record<string, unknown> }> = [];
    const invoke: ContractExportInvoke = <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, ...(args ? { args } : {}) });
      return Promise.resolve((command === "load_contract_export_summary" ? summary : result) as T);
    };
    const repository = new TauriContractExportRepository(invoke);

    await expect(repository.loadSummary()).resolves.toEqual(summary);
    await expect(repository.save("xlsx")).resolves.toEqual(result);
    expect(calls).toEqual([
      { command: "load_contract_export_summary" },
      { command: "save_contract_export", args: { format: "xlsx" } },
    ]);
  });

  it("keeps a native dialog cancellation distinct from a malformed result", async () => {
    const cancelInvoke: ContractExportInvoke = <T>() => Promise.resolve(null as T);
    const cancelled = new TauriContractExportRepository(cancelInvoke);
    await expect(cancelled.save("csv")).resolves.toBeNull();

    const malformedInvoke: ContractExportInvoke = <T>() => Promise.resolve({
      ...result,
      privatePath: "/private/synthetic.xlsx",
    } as unknown as T);
    const malformed = new TauriContractExportRepository(malformedInvoke);
    const error = await malformed.save("xlsx").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code: "invalid_response" });
    expect(contractExportSafeMessage(error)).not.toContain("/private/synthetic.xlsx");
  });

  it.each([
    ["CSV_FORMULA_RISK", "csv_blocked", "XLSX"],
    ["EXPORT_NO_DATA", "no_data", "내보낼 수 있는 계약"],
    ["EXPORT_FILE_TOO_LARGE", "limit", "허용 범위"],
    ["EXPORT_ROW_LIMIT_EXCEEDED", "limit", "허용 범위"],
    ["EXPORT_LOGICAL_TEXT_LIMIT_EXCEEDED", "limit", "허용 범위"],
    ["EXPORT_PATH_INVALID", "invalid_selection", "저장 위치와 파일 확장자"],
    ["INVALID_EXPORT_FORMAT", "invalid_selection", "형식"],
    ["UNKNOWN_NATIVE_FAILURE", "operation_failed", "내보내지 못했습니다"],
  ])("maps %s to a fixed safe error", async (nativeCode, code, message) => {
    const repository = new TauriContractExportRepository(() => Promise.reject({
      code: nativeCode,
      message: "private-path-and-source-value",
    }));

    const error = await repository.save("xlsx").catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code });
    expect(contractExportSafeMessage(error)).toContain(message);
    expect(contractExportSafeMessage(error)).not.toContain("private-path-and-source-value");
  });
});
