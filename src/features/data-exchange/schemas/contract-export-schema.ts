import { z } from "zod";

import {
  CONTRACT_EXPORT_FORMATS,
  type ContractExportFormat,
  type ContractExportResult,
  type ContractExportSummary,
} from "../types/contract-export";
import {
  ContractExportApplicationError,
  ContractExportRepositoryError,
} from "../types/contract-export-error";

const safeCountSchema = z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER);

export const ContractExportFormatSchema = z.enum(CONTRACT_EXPORT_FORMATS);

export const ContractExportSummarySchema: z.ZodType<ContractExportSummary> = z
  .object({
    exportableCount: safeCountSchema,
    missingSourceCount: safeCountSchema,
    conflictCount: safeCountSchema,
    csvAllowed: z.boolean(),
  })
  .strict();

export const ContractExportResultSchema: z.ZodType<ContractExportResult> = z
  .object({
    basename: z
      .string()
      .min(1)
      .max(255)
      .refine(isSafeBasename, "basename is invalid"),
    format: ContractExportFormatSchema,
    exportedCount: z.number().int().min(1).max(5_000),
    missingSourceCount: safeCountSchema,
    conflictCount: safeCountSchema,
  })
  .strict();

export function parseContractExportFormat(value: unknown): ContractExportFormat {
  const result = ContractExportFormatSchema.safeParse(value);
  if (!result.success) {
    throw new ContractExportApplicationError(
      "XLSX 또는 CSV 형식을 선택해 주세요.",
      "invalid_selection",
    );
  }
  return result.data;
}

export function parseContractExportSummary(value: unknown): ContractExportSummary {
  const result = ContractExportSummarySchema.safeParse(value);
  if (!result.success) {
    throw new ContractExportRepositoryError(
      "내보낼 계약 건수를 확인하지 못했습니다.",
      "invalid_response",
    );
  }
  return result.data;
}

export function parseContractExportResult(value: unknown): ContractExportResult {
  const result = ContractExportResultSchema.safeParse(value);
  if (!result.success) {
    throw new ContractExportRepositoryError(
      "계약 파일 저장 결과를 확인하지 못했습니다.",
      "invalid_response",
    );
  }
  return result.data;
}

function isSafeBasename(value: string): boolean {
  return value !== "." && value !== ".." && !/[\\/]/.test(value) &&
    [...value].every((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint >= 32 && codePoint !== 127;
    });
}
