export type ConsultationErrorCode =
  | "validation"
  | "not_found"
  | "customer_not_found"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface ConsultationValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class ConsultationValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly ConsultationValidationIssue[];

  constructor(issues: readonly ConsultationValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "ConsultationValidationError";
    this.issues = issues;
  }
}

export class ConsultationRepositoryError extends Error {
  readonly code: Exclude<ConsultationErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<ConsultationErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "ConsultationRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_CONSULTATION_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function consultationSafeMessage(error: unknown): string {
  if (
    error instanceof ConsultationRepositoryError ||
    error instanceof ConsultationValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_CONSULTATION_MESSAGE;
}
