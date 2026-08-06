export type CoverageErrorCode =
  | "validation"
  | "not_found"
  | "category_not_found"
  | "policy_not_found"
  | "customer_not_found"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface CoverageValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class CoverageValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly CoverageValidationIssue[];

  constructor(issues: readonly CoverageValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "CoverageValidationError";
    this.issues = issues;
  }
}

export class CoverageRepositoryError extends Error {
  readonly code: Exclude<CoverageErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<CoverageErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "CoverageRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_COVERAGE_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function coverageSafeMessage(error: unknown): string {
  if (
    error instanceof CoverageRepositoryError ||
    error instanceof CoverageValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_COVERAGE_MESSAGE;
}
