import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseContractExportResult,
  parseContractExportSummary,
} from "../schemas/contract-export-schema";
import type {
  ContractExportFormat,
  ContractExportResult,
  ContractExportSummary,
} from "../types/contract-export";
import {
  ContractExportError,
  ContractExportRepositoryError,
} from "../types/contract-export-error";
import type { ContractExportRepository } from "./contract-export-repository";

export type ContractExportInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: ContractExportInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

export class TauriContractExportRepository implements ContractExportRepository {
  constructor(private readonly invokeCommand: ContractExportInvoke = defaultInvoke) {}

  async loadSummary(): Promise<ContractExportSummary> {
    return this.execute(async () => parseContractExportSummary(
      await this.invokeCommand<unknown>("load_contract_export_summary"),
    ));
  }

  async save(format: ContractExportFormat): Promise<ContractExportResult | null> {
    return this.execute(async () => {
      const response = await this.invokeCommand<unknown>(
        "save_contract_export",
        { format },
      );
      return response === null ? null : parseContractExportResult(response);
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw contractExportRepositoryErrorFrom(error);
    }
  }
}

export function contractExportRepositoryErrorFrom(error: unknown): ContractExportError {
  if (error instanceof ContractExportError) return error;
  const code = decodeCommandError(error)?.code.toUpperCase() ?? "";
  if (code === "CSV_FORMULA_RISK") {
    return new ContractExportRepositoryError(
      "CSV에서 안전하게 보존할 수 없는 값이 있습니다. XLSX로 저장해 주세요.",
      "csv_blocked",
    );
  }
  if (code === "EXPORT_NO_DATA") {
    return new ContractExportRepositoryError(
      "현재 내보낼 수 있는 계약이 없습니다.",
      "no_data",
    );
  }
  if (code === "EXPORT_FILE_TOO_LARGE" || code === "EXPORT_ROW_LIMIT_EXCEEDED" ||
    code === "EXPORT_LOGICAL_TEXT_LIMIT_EXCEEDED") {
    return new ContractExportRepositoryError(
      "내보내기 허용 범위를 넘었습니다. 계약 수와 파일 크기를 확인해 주세요.",
      "limit",
    );
  }
  if (code === "EXPORT_PATH_INVALID") {
    return new ContractExportRepositoryError(
      "선택한 저장 위치와 파일 확장자를 확인해 주세요.",
      "invalid_selection",
    );
  }
  if (code.includes("FORMAT") || code.includes("VALIDATION") || code.includes("INVALID")) {
    return new ContractExportRepositoryError(
      "내보내기 형식을 확인해 주세요.",
      "invalid_selection",
    );
  }
  return new ContractExportRepositoryError();
}

function decodeCommandError(error: unknown): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}
