import {
  parseContractExportFormat,
  parseContractExportResult,
  parseContractExportSummary,
} from "../schemas/contract-export-schema";
import type { ContractExportRepository } from "../repositories/contract-export-repository";
import type {
  ContractExportResult,
  ContractExportSummary,
} from "../types/contract-export";
import {
  ContractExportApplicationError,
  ContractExportError,
} from "../types/contract-export-error";

export type ContractExportSummaryOperation =
  | { readonly status: "ready"; readonly summary: ContractExportSummary }
  | { readonly status: "stale" };

export type ContractExportSaveOperation =
  | { readonly status: "completed"; readonly result: ContractExportResult }
  | { readonly status: "cancelled" }
  | { readonly status: "stale" };

export class ContractExportApplication {
  private sequence = 0;
  private summary: ContractExportSummary | null = null;
  private saveInFlight = false;

  constructor(private readonly repository: ContractExportRepository) {}

  async loadSummary(): Promise<ContractExportSummaryOperation> {
    if (this.saveInFlight) throw busyError();
    const operation = ++this.sequence;
    try {
      const summary = parseContractExportSummary(await this.repository.loadSummary());
      if (this.isStale(operation)) return { status: "stale" };
      this.summary = summary;
      return { status: "ready", summary };
    } catch (error: unknown) {
      if (this.isStale(operation)) return { status: "stale" };
      this.summary = null;
      throw safeError(error, "내보낼 계약 건수를 불러오지 못했습니다. 다시 시도해 주세요.");
    }
  }

  async save(input: unknown): Promise<ContractExportSaveOperation> {
    if (this.saveInFlight) throw busyError();
    const format = parseContractExportFormat(input);
    this.validateSummary(format);
    const operation = ++this.sequence;
    this.saveInFlight = true;
    try {
      const response = await this.repository.save(format);
      if (this.isStale(operation)) return { status: "stale" };
      if (response === null) return { status: "cancelled" };
      const result = parseContractExportResult(response);
      if (result.format !== format) {
        throw new ContractExportApplicationError(
          "저장한 계약 파일의 형식을 확인하지 못했습니다.",
          "invalid_response",
        );
      }
      return { status: "completed", result };
    } catch (error: unknown) {
      if (this.isStale(operation)) return { status: "stale" };
      throw safeError(error, "계약 파일을 저장하지 못했습니다. 다시 시도해 주세요.");
    } finally {
      this.saveInFlight = false;
    }
  }

  clear(): void {
    this.sequence += 1;
    this.summary = null;
  }

  private validateSummary(format: "xlsx" | "csv"): void {
    if (this.summary === null) {
      throw new ContractExportApplicationError(
        "먼저 내보낼 계약 건수를 불러와 주세요.",
        "invalid_selection",
      );
    }
    if (this.summary.exportableCount === 0) {
      throw new ContractExportApplicationError(
        "현재 내보낼 수 있는 계약이 없습니다.",
        "no_data",
      );
    }
    if (format === "csv" && !this.summary.csvAllowed) {
      throw new ContractExportApplicationError(
        "CSV에서 안전하게 보존할 수 없는 값이 있습니다. XLSX로 저장해 주세요.",
        "csv_blocked",
      );
    }
  }

  private isStale(operation: number): boolean {
    return operation !== this.sequence;
  }
}

function safeError(error: unknown, message: string): ContractExportError {
  return error instanceof ContractExportError
    ? error
    : new ContractExportApplicationError(message);
}

function busyError(): ContractExportError {
  return new ContractExportApplicationError(
    "진행 중인 내보내기가 끝날 때까지 기다려 주세요.",
    "busy",
  );
}
