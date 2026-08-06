export type DataExchangeErrorCode =
  | "busy"
  | "conflict"
  | "invalid_file"
  | "invalid_response"
  | "invalid_selection"
  | "operation_failed";

const GENERIC_MESSAGE = "계약 가져오기를 처리하지 못했습니다. 다시 시도해 주세요.";

export class DataExchangeError extends Error {
  constructor(
    message = GENERIC_MESSAGE,
    readonly code: DataExchangeErrorCode = "operation_failed",
  ) {
    super(message);
    this.name = "DataExchangeError";
  }
}

export class DataExchangeApplicationError extends DataExchangeError {
  constructor(message?: string, code?: DataExchangeErrorCode) {
    super(message, code);
    this.name = "DataExchangeApplicationError";
  }
}

export class DataExchangeRepositoryError extends DataExchangeError {
  constructor(message?: string, code?: DataExchangeErrorCode) {
    super(message, code);
    this.name = "DataExchangeRepositoryError";
  }
}

export interface DataExchangeValidationIssue {
  readonly field: string;
  readonly message: string;
}

export class DataExchangeValidationError extends DataExchangeError {
  constructor(readonly issues: readonly DataExchangeValidationIssue[]) {
    super("가져오기 선택 내용을 확인해 주세요.", "invalid_selection");
    this.name = "DataExchangeValidationError";
  }
}

export function dataExchangeSafeMessage(error: unknown): string {
  return error instanceof DataExchangeError ? error.message : GENERIC_MESSAGE;
}
