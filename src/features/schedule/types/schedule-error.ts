export type ScheduleErrorCode =
  | "validation"
  | "not_found"
  | "customer_not_found"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface ScheduleValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class ScheduleValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly ScheduleValidationIssue[];

  constructor(issues: readonly ScheduleValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "ScheduleValidationError";
    this.issues = issues;
  }
}

export class ScheduleRepositoryError extends Error {
  readonly code: Exclude<ScheduleErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<ScheduleErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "ScheduleRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_SCHEDULE_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function scheduleSafeMessage(error: unknown): string {
  if (
    error instanceof ScheduleRepositoryError ||
    error instanceof ScheduleValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_SCHEDULE_MESSAGE;
}
