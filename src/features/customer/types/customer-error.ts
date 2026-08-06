export type CustomerErrorCode =
  | "validation"
  | "not_found"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface CustomerValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class CustomerValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly CustomerValidationIssue[];

  constructor(issues: readonly CustomerValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "CustomerValidationError";
    this.issues = issues;
  }
}

export class CustomerRepositoryError extends Error {
  readonly code: Exclude<CustomerErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<CustomerErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "CustomerRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_CUSTOMER_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function customerSafeMessage(error: unknown): string {
  if (
    error instanceof CustomerRepositoryError ||
    error instanceof CustomerValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_CUSTOMER_MESSAGE;
}
