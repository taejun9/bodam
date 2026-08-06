import { describe, expect, it } from "vitest";

import { parseParsedImportFile } from "../schemas/contract-source-schema";
import {
  parseImportContextQuery,
  parseImportContextSnapshot,
} from "../schemas/import-context-schema";
import { DataExchangeError } from "../types/data-exchange-error";
import {
  contextSnapshot,
  duplicateCandidate,
  parsedFile,
  sourceRow,
} from "./data-exchange-test-data";

describe("data exchange strict schemas", () => {
  it("accepts the exact 21 named cells and rejects missing or extra properties", () => {
    expect(parseParsedImportFile(parsedFile()).rows[0]?.cells.policyNumber)
      .toBe("000-POLICY");

    const missing = structuredClone(parsedFile()) as unknown as Record<string, unknown>;
    const missingRows = missing.rows as Array<{ cells: Record<string, unknown> }>;
    delete missingRows[0]?.cells.manager;
    expect(() => parseParsedImportFile(missing)).toThrow(DataExchangeError);

    const extra = structuredClone(parsedFile()) as unknown as Record<string, unknown>;
    const extraRows = extra.rows as Array<{ cells: Record<string, unknown> }>;
    if (extraRows[0]) extraRows[0].cells.raw = "private-row-value";
    expect(() => parseParsedImportFile(extra)).toThrow(
      "선택한 파일의 응답을 확인할 수 없습니다.",
    );
  });

  it("rejects paths, unpaired surrogates, format drift and unstable source rows", () => {
    expect(() => parseParsedImportFile({ ...parsedFile(), basename: "/tmp/private.xlsx" }))
      .toThrow(DataExchangeError);
    expect(() => parseParsedImportFile(parsedFile([
      sourceRow(2),
      { ...sourceRow(3), format: "csv" },
    ]))).toThrow(DataExchangeError);
    expect(() => parseParsedImportFile(parsedFile([sourceRow(3), sourceRow(2)])))
      .toThrow(DataExchangeError);
    expect(() => parseParsedImportFile(parsedFile([
      sourceRow(2, { manager: "\ud800" }),
    ]))).toThrow(DataExchangeError);
  });

  it("requires row issues to reference a returned row and keeps safe issue fields strict", () => {
    expect(() => parseParsedImportFile({
      ...parsedFile(),
      issues: [{ sourceRow: 99, field: "insurer", code: "FORMULA", message: "안전 오류" }],
    })).toThrow(DataExchangeError);
    expect(() => parseParsedImportFile({
      ...parsedFile(),
      issues: [{ sourceRow: 2, field: "unknown", code: "FORMULA", message: "안전 오류" }],
    })).toThrow(DataExchangeError);
  });

  it("accepts existing customer names without a length or NFC migration requirement", () => {
    const longNfdName = `A\u030A${"가".repeat(4_100)}`;
    const snapshot = {
      ...contextSnapshot([duplicateCandidate()]),
      customers: [
        { id: contextSnapshot().customers[0]!.id, name: longNfdName },
      ],
      duplicateCandidates: [{
        ...duplicateCandidate(),
        customerId: contextSnapshot().customers[0]!.id,
      }],
    };

    expect(parseImportContextSnapshot(snapshot).customers[0]?.name).toBe(longNfdName);
  });

  it("requires unique normalized duplicate query keys and active candidate parents", () => {
    const key = { insurer: "합성보험", policyNumber: "000-POLICY" };
    expect(parseImportContextQuery({ keys: [key] })).toEqual({ keys: [key] });
    expect(() => parseImportContextQuery({ keys: [key, key] })).toThrow(DataExchangeError);
    expect(() => parseImportContextQuery({
      keys: [{ insurer: " 합성보험", policyNumber: "000-POLICY" }],
    })).toThrow(DataExchangeError);
    expect(() => parseImportContextSnapshot({
      ...contextSnapshot(),
      duplicateCandidates: [duplicateCandidate({ customerId: "00000000-0000-4000-8000-999999999999" })],
    })).toThrow(DataExchangeError);
  });
});
