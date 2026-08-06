import { describe, expect, it } from "vitest";

import {
  parseContractExportFormat,
  parseContractExportResult,
  parseContractExportSummary,
} from "../schemas/contract-export-schema";

const summary = {
  exportableCount: 3,
  missingSourceCount: 1,
  conflictCount: 2,
  csvAllowed: true,
};

const result = {
  basename: "BODAM-contracts-20260807-120000.xlsx",
  format: "xlsx" as const,
  exportedCount: 3,
  missingSourceCount: 1,
  conflictCount: 2,
};

describe("contract export schemas", () => {
  it("accepts only the fixed summary, format, and pathless result contracts", () => {
    expect(parseContractExportFormat("xlsx")).toBe("xlsx");
    expect(parseContractExportFormat("csv")).toBe("csv");
    expect(parseContractExportSummary(summary)).toEqual(summary);
    expect(parseContractExportResult(result)).toEqual(result);
  });

  it("rejects extra fields and unsafe counts with fixed errors", () => {
    expect(() => parseContractExportSummary({ ...summary, privateRow: "marker" }))
      .toThrow("내보낼 계약 건수를 확인하지 못했습니다");
    expect(() => parseContractExportSummary({ ...summary, exportableCount: -1 }))
      .toThrow("내보낼 계약 건수를 확인하지 못했습니다");
    expect(() => parseContractExportSummary({
      ...summary,
      exportableCount: Number.MAX_SAFE_INTEGER + 1,
    })).toThrow("내보낼 계약 건수를 확인하지 못했습니다");
  });

  it.each([
    "private/path.xlsx",
    "private\\path.xlsx",
    ".",
    "..",
    "private\u0007.xlsx",
  ])("rejects a non-basename result value: %s", (basename) => {
    expect(() => parseContractExportResult({ ...result, basename }))
      .toThrow("계약 파일 저장 결과를 확인하지 못했습니다");
  });

  it("rejects empty export results and unsupported input formats", () => {
    expect(() => parseContractExportResult({ ...result, exportedCount: 0 }))
      .toThrow("계약 파일 저장 결과를 확인하지 못했습니다");
    expect(() => parseContractExportFormat("pdf")).toThrow("XLSX 또는 CSV");
  });
});
