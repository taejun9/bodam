export type BackupErrorCode =
  | "busy"
  | "corrupt"
  | "invalid_selection"
  | "native_unavailable"
  | "operation_failed"
  | "restore_failed"
  | "schema_incompatible"
  | "storage_unavailable";

const GENERIC_MESSAGE = "백업 작업을 완료하지 못했습니다. 현재 데이터는 변경되지 않았습니다.";

export class BackupError extends Error {
  constructor(
    message = GENERIC_MESSAGE,
    readonly code: BackupErrorCode = "operation_failed",
  ) {
    super(message);
    this.name = "BackupError";
  }
}

export class BackupApplicationError extends BackupError {
  constructor(message?: string, code?: BackupErrorCode) {
    super(message, code);
    this.name = "BackupApplicationError";
  }
}

export class BackupRepositoryError extends BackupError {
  constructor(message?: string, code?: BackupErrorCode) {
    super(message, code);
    this.name = "BackupRepositoryError";
  }
}

export function backupSafeMessage(error: unknown): string {
  return error instanceof BackupError ? error.message : GENERIC_MESSAGE;
}
