import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  backupResultSchema,
  backupStatusSchema,
  restorePreparedSchema,
  restorePreviewSchema,
} from "../schemas/backup-schema";
import type {
  RestorePrepared,
} from "../types/backup";
import { BackupError, BackupRepositoryError } from "../types/backup-error";
import type { BackupRepository } from "./backup-repository";

export type BackupInvoke = (
  command: string,
  args?: Record<string, unknown>,
) => Promise<unknown>;
const defaultInvoke: BackupInvoke = (command, args) => invoke<unknown>(command, args);
const commandError = z.object({ code: z.string() }).passthrough();

export class TauriBackupRepository implements BackupRepository {
  readonly nativeAvailable = true;
  constructor(private readonly invokeCommand: BackupInvoke = defaultInvoke) {}

  loadStatus = () => this.run(async () => backupStatusSchema.parse(
    await this.invokeCommand("load_backup_status"),
  ));
  acknowledgeRestoreStartup = () => this.run(async () => {
    await this.invokeCommand("acknowledge_restore_startup");
  });
  chooseDirectory = () => this.run(async () => {
    const value = await this.invokeCommand("choose_backup_directory");
    return value === null ? null : backupStatusSchema.parse(value);
  });
  useDefaultDirectory = () => this.run(async () => backupStatusSchema.parse(
    await this.invokeCommand("use_default_backup_directory"),
  ));
  createManual = () => this.run(async () => backupResultSchema.parse(
    await this.invokeCommand("create_manual_backup"),
  ));
  chooseRestore = () => this.run(async () => {
    const value = await this.invokeCommand("choose_restore_backup");
    return value === null ? null : restorePreviewSchema.parse(value);
  });
  discardRestore = (token: string) => this.run(async () => {
    await this.invokeCommand("discard_restore_preview", { token });
  });
  prepareRestore = (token: string): Promise<RestorePrepared> => this.run(async () =>
    restorePreparedSchema.parse(await this.invokeCommand("prepare_backup_restore", { token }))
  );
  restartForRestore = () => this.run(async () => {
    await this.invokeCommand("restart_for_backup_restore");
  });
  checkDaily = () => this.run(async () => backupStatusSchema.parse(
    await this.invokeCommand("check_daily_backup"),
  ));
  retryExit = () => this.run(async () => { await this.invokeCommand("retry_exit_backup"); });
  exitWithoutBackup = () => this.run(async () => {
    await this.invokeCommand("exit_without_backup");
  });

  private async run<T>(operation: () => Promise<T>): Promise<T> {
    try { return await operation(); } catch (error: unknown) { throw mapError(error); }
  }
}

function mapError(error: unknown): BackupError {
  if (error instanceof BackupError) return error;
  const code = decodeCode(error);
  if (code.includes("BUSY")) return failure("다른 백업 작업이 진행 중입니다.", "busy");
  if (code.includes("FUTURE") || code.includes("SCHEMA") || code.includes("MIGRATION")) {
    return failure("현재 앱에서 복원할 수 없는 데이터베이스 버전입니다.", "schema_incompatible");
  }
  if (
    code.includes("CHECKSUM")
    || code.includes("CORRUPT")
    || code.includes("INTEGRITY")
    || code.includes("ARCHIVE")
    || code.includes("DATABASE_INVALID")
  ) {
    return failure("백업 파일이 손상되었거나 검증값이 일치하지 않습니다.", "corrupt");
  }
  if (code.includes("PATH") || code.includes("SELECTION") || code.includes("FORMAT")) {
    return failure("선택한 백업 파일이나 폴더를 확인해 주세요.", "invalid_selection");
  }
  if (code.includes("DIRECTORY") || code.includes("PERMISSION") || code.includes("STORAGE")) {
    return failure("백업 위치를 사용할 수 없습니다. 다른 로컬 폴더를 선택해 주세요.", "storage_unavailable");
  }
  if (code.includes("SAVE") || code.includes("SNAPSHOT")) {
    return failure("검증된 백업 파일을 만들지 못했습니다. 저장 위치를 확인해 주세요.", "storage_unavailable");
  }
  if (code.includes("RESTORE")) {
    return failure("복원하지 못했습니다. 현재 데이터는 보존되었습니다.", "restore_failed");
  }
  return new BackupRepositoryError();
}

function failure(message: string, code: ConstructorParameters<typeof BackupRepositoryError>[1]) {
  return new BackupRepositoryError(message, code);
}

function decodeCode(error: unknown): string {
  if (typeof error === "string") {
    try { return commandError.parse(JSON.parse(error)).code.toUpperCase(); }
    catch { return error.toUpperCase(); }
  }
  return commandError.safeParse(error).data?.code.toUpperCase() ?? "";
}
