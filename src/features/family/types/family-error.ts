export type FamilyErrorCode =
  | "validation"
  | "not_found"
  | "membership_not_found"
  | "customer_not_found"
  | "conflict"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface FamilyValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class FamilyValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly FamilyValidationIssue[];

  constructor(issues: readonly FamilyValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "FamilyValidationError";
    this.issues = issues;
  }
}

export class FamilyRepositoryError extends Error {
  readonly code: Exclude<FamilyErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<FamilyErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "FamilyRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_FAMILY_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function familySafeMessage(error: unknown): string {
  if (
    error instanceof FamilyRepositoryError ||
    error instanceof FamilyValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_FAMILY_MESSAGE;
}
