import { describe, expect, it } from "vitest";

import { mapContractSourceRow } from "../services/contract-row-mapper";
import {
  TauriDataExchangeRepository,
  type DataExchangeInvoke,
} from "../repositories/tauri-data-exchange-repository";
import { TauriImportContextReader } from "../repositories/tauri-import-context-reader";
import type { ImportCommitRequest, ImportCommitResult } from "../types/import-commit";
import type { ParsedImportFile } from "../types/contract-source";
import {
  dataExchangeSafeMessage,
} from "../types/data-exchange-error";
import {
  contextSnapshot,
  ids,
  parsedFile,
  sourceRow,
} from "./data-exchange-test-data";

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

function request(): ImportCommitRequest {
  const source = sourceRow();
  const mapped = mapContractSourceRow(source).mapped;
  if (mapped === null) throw new Error("synthetic mapping must be valid");
  return {
    previewId: ids.preview,
    snapshotToken: "a".repeat(64),
    format: "xlsx",
    newCustomers: [],
    rows: [{
      source,
      mapped,
      decision: {
        action: "create",
        customer: { kind: "existing", customerId: ids.customerOne },
      },
    }],
    summary: { totalRows: 1, invalidRows: 0, unselectedRows: 0 },
  };
}

const result: ImportCommitResult = {
  created: 1,
  updated: 0,
  skipped: 0,
  totalRows: 1,
  invalidRows: 0,
  unselectedRows: 0,
  outcomes: [{ sourceRow: 2, outcome: "created", policyId: ids.policyOne }],
};

function invocationHarness(overrides: Record<string, unknown> = {}) {
  const calls: Invocation[] = [];
  const responses: Record<string, unknown> = {
    choose_contract_import_file: parsedFile(),
    load_contract_import_context: contextSnapshot(),
    commit_contract_import: result,
    ...overrides,
  };
  const invoke: DataExchangeInvoke = <T>(
    command: string,
    args?: Record<string, unknown>,
  ): Promise<T> => {
    calls.push({ command, args });
    return Promise.resolve(responses[command] as T);
  };
  return {
    calls,
    contextReader: new TauriImportContextReader(invoke),
    repository: new TauriDataExchangeRepository(invoke),
  };
}

describe("TauriDataExchangeRepository", () => {
  it("uses only the pathless chooser and strict commit command payload", async () => {
    const { calls, contextReader, repository } = invocationHarness();

    await expect(repository.chooseFile()).resolves.toEqual(parsedFile());
    const query = { keys: [{ insurer: "합성보험", policyNumber: "000-POLICY" }] };
    await expect(contextReader.load(query)).resolves.toEqual(contextSnapshot());
    await expect(repository.commit(request())).resolves.toEqual(result);
    expect(calls).toEqual([
      { command: "choose_contract_import_file", args: undefined },
      { command: "load_contract_import_context", args: { query } },
      { command: "commit_contract_import", args: { request: request() } },
    ]);
  });

  it("keeps dialog cancellation distinct from a malformed response", async () => {
    await expect(invocationHarness({
      choose_contract_import_file: null,
    }).repository.chooseFile()).resolves.toBeNull();

    const malformed = {
      ...parsedFile(),
      privateRow: "synthetic-private-marker",
    } as ParsedImportFile;
    const repository = invocationHarness({
      choose_contract_import_file: malformed,
    }).repository;
    await expect(repository.chooseFile()).rejects.toMatchObject({
      code: "invalid_response",
    });
    await expect(repository.chooseFile()).rejects.not.toThrow("synthetic-private-marker");
  });

  it.each([
    ["IMPORT_CONFLICT", "conflict", "데이터가 변경되었습니다"],
    ["FILE_TOO_LARGE", "invalid_file", "허용 범위"],
    ["HEADER_MISMATCH", "invalid_file", "21개 열"],
    ["INVALID_CSV_ENCODING", "invalid_file", ".xlsx 또는 .csv"],
    ["UNKNOWN_NATIVE_FAILURE", "operation_failed", "처리하지 못했습니다"],
  ])("maps %s to fixed safe errors", async (nativeCode, code, message) => {
    const invoke: DataExchangeInvoke = () => Promise.reject({
      code: nativeCode,
      message: "private-file-path-and-row-value",
    });
    const repository = new TauriDataExchangeRepository(invoke);

    const error = await repository.chooseFile().catch((caught: unknown) => caught);
    expect(error).toMatchObject({ code });
    expect(dataExchangeSafeMessage(error)).toContain(message);
    expect(dataExchangeSafeMessage(error)).not.toContain("private-file-path-and-row-value");
  });

  it("rejects an extra commit field before invoking native code", async () => {
    const { calls, repository } = invocationHarness();
    const malformed = { ...request(), privatePath: "/tmp/private.xlsx" } as ImportCommitRequest;

    await expect(repository.commit(malformed)).rejects.toMatchObject({
      code: "invalid_selection",
    });
    expect(calls).toEqual([]);
  });
});
