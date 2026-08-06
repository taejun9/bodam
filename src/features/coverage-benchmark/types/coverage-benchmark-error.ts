export type CoverageBenchmarkErrorCode =
  | "validation"
  | "not_found"
  | "category_not_found"
  | "conflict"
  | "storage_corrupt"
  | "storage_unavailable"
  | "unexpected";

export interface CoverageBenchmarkValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class CoverageBenchmarkValidationError extends Error {
  readonly code = "validation" as const;
  readonly issues: readonly CoverageBenchmarkValidationIssue[];

  constructor(issues: readonly CoverageBenchmarkValidationIssue[]) {
    super("입력 내용을 확인해 주세요.");
    this.name = "CoverageBenchmarkValidationError";
    this.issues = issues;
  }
}

export class CoverageBenchmarkRepositoryError extends Error {
  readonly code: Exclude<CoverageBenchmarkErrorCode, "validation">;

  constructor(
    message: string,
    code: Exclude<CoverageBenchmarkErrorCode, "validation"> = "unexpected",
  ) {
    super(message);
    this.name = "CoverageBenchmarkRepositoryError";
    this.code = code;
  }
}

const UNEXPECTED_BENCHMARK_MESSAGE =
  "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.";

export function coverageBenchmarkSafeMessage(error: unknown): string {
  if (
    error instanceof CoverageBenchmarkRepositoryError ||
    error instanceof CoverageBenchmarkValidationError
  ) {
    return error.message;
  }
  return UNEXPECTED_BENCHMARK_MESSAGE;
}
