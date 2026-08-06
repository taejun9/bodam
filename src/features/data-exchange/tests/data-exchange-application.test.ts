import { describe, expect, it, vi } from "vitest";

import { DataExchangeApplication } from "../application/data-exchange-application";
import type {
  DataExchangeRepository,
  ImportContextReader,
} from "../repositories/data-exchange-repository";
import type { ImportCommitDraft, ImportCommitResult } from "../types/import-commit";
import { DataExchangeError } from "../types/data-exchange-error";
import {
  contextSnapshot,
  ids,
  parsedFile,
} from "./data-exchange-test-data";

const draft = (): ImportCommitDraft => ({
  previewId: ids.preview,
  newCustomers: [],
  rows: [{
    sourceRow: 2,
    decision: {
      action: "create",
      customer: { kind: "existing", customerId: ids.customerOne },
    },
  }],
});

const commitResult = (): ImportCommitResult => ({
  created: 1,
  updated: 0,
  skipped: 0,
  totalRows: 1,
  invalidRows: 0,
  unselectedRows: 0,
  outcomes: [{ sourceRow: 2, outcome: "created", policyId: ids.policyOne }],
});

function dependencies() {
  const repository: DataExchangeRepository = {
    chooseFile: vi.fn().mockResolvedValue(parsedFile()),
    commit: vi.fn().mockResolvedValue(commitResult()),
  };
  const contextReader: ImportContextReader = {
    load: vi.fn().mockResolvedValue(contextSnapshot()),
  };
  const application = new DataExchangeApplication(
    repository,
    contextReader,
    () => ids.preview,
  );
  return { application, repository, contextReader };
}

describe("DataExchangeApplication", () => {
  it("loads a strict file and context snapshot into a ready preview", async () => {
    const { application, contextReader } = dependencies();

    const operation = await application.chooseFile();

    expect(operation.status).toBe("ready");
    if (operation.status !== "ready") return;
    expect(operation.preview.previewId).toBe(ids.preview);
    expect(operation.preview.rows[0]?.mapped?.monthlyPremiumWon).toBe("1200");
    expect(contextReader.load).toHaveBeenCalledWith({
      keys: [{ insurer: "합성보험", policyNumber: "000-POLICY" }],
    });
  });

  it("treats dialog cancellation separately and suppresses an older selection", async () => {
    const { application, repository, contextReader } = dependencies();
    const first = deferred<ReturnType<typeof parsedFile>>();
    vi.mocked(repository.chooseFile)
      .mockImplementationOnce(() => first.promise)
      .mockResolvedValueOnce(null);

    const older = application.chooseFile();
    await expect(application.chooseFile()).resolves.toEqual({ status: "cancelled" });
    first.resolve(parsedFile());

    await expect(older).resolves.toEqual({ status: "stale" });
    expect(contextReader.load).not.toHaveBeenCalled();
  });

  it("does not let an older context response replace a newer preview", async () => {
    const { application, contextReader } = dependencies();
    const firstContext = deferred<ReturnType<typeof contextSnapshot>>();
    vi.mocked(contextReader.load)
      .mockImplementationOnce(() => firstContext.promise)
      .mockResolvedValueOnce({ ...contextSnapshot(), snapshotToken: "b".repeat(64) });

    const older = application.chooseFile();
    await vi.waitFor(() => expect(contextReader.load).toHaveBeenCalledTimes(1));
    const newer = application.chooseFile();
    await expect(newer).resolves.toMatchObject({
      status: "ready",
      preview: { snapshotToken: "b".repeat(64) },
    });
    firstContext.resolve(contextSnapshot());

    await expect(older).resolves.toEqual({ status: "stale" });
  });

  it("redacts unexpected dependency errors", async () => {
    const { application, contextReader } = dependencies();
    vi.mocked(contextReader.load).mockRejectedValueOnce(
      new Error("private-workbook-row-value"),
    );

    const error = await application.chooseFile().catch((caught: unknown) => caught);
    expect(error).toMatchObject({
      message: "미리보기를 준비하지 못했습니다. 다시 시도해 주세요.",
    });
    expect(String(error)).not.toContain("private-workbook-row-value");
  });

  it("commits the current preview once and releases its in-memory session", async () => {
    const { application, repository } = dependencies();
    await application.chooseFile();

    await expect(application.commit(draft())).resolves.toEqual({
      status: "completed",
      result: commitResult(),
    });
    expect(repository.commit).toHaveBeenCalledTimes(1);
    await expect(application.commit(draft())).rejects.toMatchObject({
      code: "invalid_selection",
      issues: [{ field: "preview", message: "먼저 가져올 파일을 선택해 주세요." }],
    });
  });

  it("suppresses a commit result after clear and blocks a concurrent retry", async () => {
    const { application, repository } = dependencies();
    const pending = deferred<ImportCommitResult>();
    vi.mocked(repository.commit).mockImplementationOnce(() => pending.promise);
    await application.chooseFile();

    const commit = application.commit(draft());
    await expect(application.commit(draft())).rejects.toMatchObject({ code: "busy" });
    application.clear();
    pending.resolve(commitResult());

    await expect(commit).resolves.toEqual({ status: "stale" });
  });

  it("invalidates a conflicted preview so decisions must be refreshed", async () => {
    const { application, repository } = dependencies();
    vi.mocked(repository.commit).mockRejectedValueOnce(
      new DataExchangeError("데이터가 변경되었습니다.", "conflict"),
    );
    await application.chooseFile();

    await expect(application.commit(draft())).rejects.toMatchObject({ code: "conflict" });
    await expect(application.commit(draft())).rejects.toMatchObject({
      code: "invalid_selection",
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
