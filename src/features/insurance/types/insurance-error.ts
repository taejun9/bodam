export type InsuranceErrorCode =
  | "validation"
  | "not_found"
  | "customer_not_found"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface InsuranceValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class InsuranceValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly InsuranceValidationIssue[];

  constructor(issues: readonly InsuranceValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "InsuranceValidationError";
    this.issues = issues;
  }
}

export class InsuranceRepositoryError extends Error {
  readonly code: Exclude<InsuranceErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<InsuranceErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "InsuranceRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_INSURANCE_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function insuranceSafeMessage(error: unknown): string {
  if (
    error instanceof InsuranceRepositoryError ||
    error instanceof InsuranceValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_INSURANCE_MESSAGE;
}
