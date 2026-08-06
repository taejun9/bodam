import { describe, expect, it, vi } from "vitest";

import { BackupApplication } from "../application/backup-application";
import type { BackupRepository } from "../repositories/backup-repository";
import { BackupRepositoryError } from "../types/backup-error";

const status = {
  available: true,
  location: { kind: "default" as const, basename: null, available: true },
  lastSuccessfulAt: null,
  automaticCount: 0,
  maxAutomaticCount: 30 as const,
  lastFailure: null,
  restoreStartup: null,
  exitFailurePending: false,
};

function repository(overrides: Partial<BackupRepository> = {}): BackupRepository {
  return {
    nativeAvailable: true,
    loadStatus: vi.fn(async () => status),
    acknowledgeRestoreStartup: vi.fn(async () => undefined),
    chooseDirectory: vi.fn(async () => status),
    useDefaultDirectory: vi.fn(async () => status),
    createManual: vi.fn(async () => ({
      basename: "synthetic.bodam-backup",
      createdAt: "2026-08-07T03:00:00.000Z",
      reason: "manual" as const,
      retentionWarning: false,
    })),
    chooseRestore: vi.fn(async () => null),
    discardRestore: vi.fn(async () => undefined),
    prepareRestore: vi.fn(async () => ({
      restartRequired: true as const,
      safetyBackupBasename: "safety.bodam-backup",
    })),
    restartForRestore: vi.fn(async () => undefined),
    checkDaily: vi.fn(async () => status),
    retryExit: vi.fn(async () => undefined),
    exitWithoutBackup: vi.fn(async () => undefined),
    ...overrides,
  };
}

describe("BackupApplication", () => {
  it("parses status, explicitly acknowledges startup, and handles cancellation", async () => {
    const acknowledgeRestoreStartup = vi.fn(async () => undefined);
    const application = new BackupApplication(repository({ acknowledgeRestoreStartup }));
    await expect(application.loadStatus()).resolves.toEqual(status);
    await expect(application.acknowledgeRestoreStartup()).resolves.toBeUndefined();
    await expect(application.createManual()).resolves.toMatchObject({ reason: "manual" });
    await expect(application.chooseRestore()).resolves.toBeNull();
    expect(acknowledgeRestoreStartup).toHaveBeenCalledOnce();
  });

  it("locks overlapping mutations", async () => {
    let resolve!: (value: typeof status) => void;
    const pending = new Promise<typeof status>((done) => { resolve = done; });
    const application = new BackupApplication(repository({ chooseDirectory: () => pending }));
    const first = application.chooseDirectory();
    await expect(application.createManual()).rejects.toMatchObject({ code: "busy" });
    resolve(status);
    await expect(first).resolves.toEqual(status);
  });

  it("shares one in-flight daily check between lifecycle and Settings", async () => {
    let resolve!: (value: typeof status) => void;
    const pending = new Promise<typeof status>((done) => { resolve = done; });
    const checkDaily = vi.fn(() => pending);
    const application = new BackupApplication(repository({ checkDaily }));

    const lifecycle = application.checkDaily();
    const settings = application.checkDaily();
    expect(checkDaily).toHaveBeenCalledTimes(1);
    resolve(status);
    await expect(Promise.all([lifecycle, settings])).resolves.toEqual([status, status]);

    await application.checkDaily();
    expect(checkDaily).toHaveBeenCalledTimes(2);
  });

  it("serializes lifecycle daily checks and user mutations in both directions", async () => {
    let resolveDaily!: (value: typeof status) => void;
    const pendingDaily = new Promise<typeof status>((done) => { resolveDaily = done; });
    const createManual = vi.fn(repository().createManual);
    const application = new BackupApplication(repository({
      checkDaily: vi.fn(() => pendingDaily), createManual,
    }));

    const daily = application.checkDaily();
    const manual = application.createManual();
    expect(createManual).not.toHaveBeenCalled();
    resolveDaily(status);
    await daily;
    await manual;
    expect(createManual).toHaveBeenCalledTimes(1);

    let resolveManual!: (value: Awaited<ReturnType<BackupRepository["createManual"]>>) => void;
    const pendingManual = new Promise<Awaited<ReturnType<BackupRepository["createManual"]>>>(
      (done) => { resolveManual = done; },
    );
    const delayedDaily = vi.fn(async () => status);
    const second = new BackupApplication(repository({
      createManual: () => pendingManual, checkDaily: delayedDaily,
    }));
    const mutation = second.createManual();
    const queuedDaily = second.checkDaily();
    expect(delayedDaily).not.toHaveBeenCalled();
    resolveManual(await repository().createManual());
    await mutation;
    await queuedDaily;
    expect(delayedDaily).toHaveBeenCalledTimes(1);
  });

  it("queues preview discard behind a daily check and propagates cleanup errors", async () => {
    let resolveDaily!: (value: typeof status) => void;
    const pendingDaily = new Promise<typeof status>((resolve) => { resolveDaily = resolve; });
    const discardRestore = vi.fn()
      .mockRejectedValueOnce(new BackupRepositoryError("합성 폐기 실패"))
      .mockResolvedValue(undefined);
    const application = new BackupApplication(repository({
      checkDaily: () => pendingDaily,
      discardRestore,
    }));

    const daily = application.checkDaily();
    const failedDiscard = application.discardRestore(
      "12000000-0000-4000-8000-000000000001",
    );
    const failedDiscardResult = expect(failedDiscard).rejects.toMatchObject({
      message: "합성 폐기 실패",
    });
    expect(discardRestore).not.toHaveBeenCalled();
    resolveDaily(status);
    await daily;
    await failedDiscardResult;

    await expect(application.discardRestore(
      "22000000-0000-4000-8000-000000000002",
    )).resolves.toBeUndefined();
    expect(discardRestore).toHaveBeenCalledTimes(2);
  });
});
