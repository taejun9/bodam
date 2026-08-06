export type ContractExportErrorCode =
  | "busy"
  | "csv_blocked"
  | "invalid_response"
  | "invalid_selection"
  | "limit"
  | "no_data"
  | "operation_failed";

const GENERIC_EXPORT_MESSAGE =
  "계약 파일을 내보내지 못했습니다. 다시 시도해 주세요.";

export class ContractExportError extends Error {
  constructor(
    message = GENERIC_EXPORT_MESSAGE,
    readonly code: ContractExportErrorCode = "operation_failed",
  ) {
    super(message);
    this.name = "ContractExportError";
  }
}

export class ContractExportApplicationError extends ContractExportError {
  constructor(message?: string, code?: ContractExportErrorCode) {
    super(message, code);
    this.name = "ContractExportApplicationError";
  }
}

export class ContractExportRepositoryError extends ContractExportError {
  constructor(message?: string, code?: ContractExportErrorCode) {
    super(message, code);
    this.name = "ContractExportRepositoryError";
  }
}

export function contractExportSafeMessage(error: unknown): string {
  return error instanceof ContractExportError
    ? error.message
    : GENERIC_EXPORT_MESSAGE;
}
