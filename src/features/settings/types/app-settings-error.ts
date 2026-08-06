export type AppSettingsErrorCode =
  | "validation"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface AppSettingsValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class AppSettingsValidationError extends Error {
  readonly code = "validation" as const;

  constructor(readonly issues: readonly AppSettingsValidationIssue[]) {
    super("설정 입력 내용을 확인해 주세요.");
    this.name = "AppSettingsValidationError";
  }
}

export class AppSettingsRepositoryError extends Error {
  constructor(
    message = "설정을 처리하지 못했습니다. 다시 시도해 주세요.",
    readonly code: Exclude<AppSettingsErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "AppSettingsRepositoryError";
  }
}

const UNEXPECTED_SETTINGS_MESSAGE =
  "설정 작업을 완료하지 못했습니다. 다시 시도해 주세요.";

export function appSettingsSafeMessage(error: unknown): string {
  if (
    error instanceof AppSettingsRepositoryError ||
    error instanceof AppSettingsValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_SETTINGS_MESSAGE;
}
