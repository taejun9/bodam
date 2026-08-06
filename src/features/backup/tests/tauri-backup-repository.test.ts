import { describe, expect, it, vi } from "vitest";

import {
  TauriBackupRepository,
  type BackupInvoke,
} from "../repositories/tauri-backup-repository";
import type { BackupRepositoryError } from "../types/backup-error";

const status = {
  available: true,
  location: { kind: "default", basename: null, available: true },
  lastSuccessfulAt: null,
  automaticCount: 0,
  maxAutomaticCount: 30,
  lastFailure: null,
  restoreStartup: null,
  exitFailurePending: false,
};

describe("TauriBackupRepository", () => {
  it("uses pathless command arguments and parses cancellation", async () => {
    const invoke = vi.fn(async (command: string) =>
      command === "load_backup_status" ? status : null
    );
    const repository = new TauriBackupRepository(invoke);

    await expect(repository.loadStatus()).resolves.toEqual(status);
    await expect(repository.acknowledgeRestoreStartup()).resolves.toBeUndefined();
    await expect(repository.chooseDirectory()).resolves.toBeNull();
    await expect(repository.chooseRestore()).resolves.toBeNull();
    expect(invoke.mock.calls).toEqual([
      ["load_backup_status"],
      ["acknowledge_restore_startup"],
      ["choose_backup_directory"],
      ["choose_restore_backup"],
    ]);
  });

  it("passes only opaque restore tokens and maps safe error codes", async () => {
    const invoke: BackupInvoke = vi.fn(async (
      _command: string,
      args?: Record<string, unknown>,
    ) => {
      expect(args).toEqual({ token: "12000000-0000-4000-8000-000000000001" });
      throw { code: "BACKUP_CHECKSUM_MISMATCH", path: "/not/reflected" };
    });
    const repository = new TauriBackupRepository(invoke);

    await expect(repository.prepareRestore("12000000-0000-4000-8000-000000000001"))
      .rejects.toMatchObject({ code: "corrupt" } satisfies Partial<BackupRepositoryError>);
  });

  it.each([
    ["BACKUP_ARCHIVE_TOO_LARGE", "corrupt"],
    ["BACKUP_DATABASE_INVALID", "corrupt"],
    ["BACKUP_SAVE_FAILED", "storage_unavailable"],
    ["BACKUP_SNAPSHOT_FAILED", "storage_unavailable"],
  ] as const)("maps %s without reflecting backend details", async (code, expected) => {
    const repository = new TauriBackupRepository(async () => {
      throw { code, path: "/private/synthetic-marker" };
    });

    await expect(repository.createManual()).rejects.toMatchObject({ code: expected });
  });
});
