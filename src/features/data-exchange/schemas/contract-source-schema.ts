import { z } from "zod";

import {
  CONTRACT_FILE_FORMATS,
  CONTRACT_SOURCE_FIELDS,
  type ContractSourceCells,
  type ParsedImportFile,
} from "../types/contract-source";
import { DataExchangeRepositoryError } from "../types/data-exchange-error";
import {
  isBoundedUnicodeText,
  MAX_SOURCE_CELL_CHARS,
} from "../services/contract-normalization";

export const ContractFileFormatSchema = z.enum(CONTRACT_FILE_FORMATS);

const sourceCellSchema = z
  .string()
  .refine(
    (value) => isBoundedUnicodeText(value, MAX_SOURCE_CELL_CHARS),
    "source cell is invalid",
  )
  .nullable();

export const ContractSourceCellsSchema: z.ZodType<ContractSourceCells> = z
  .object({
    no: sourceCellSchema,
    collectionReflectedOn: sourceCellSchema,
    affiliation: sourceCellSchema,
    manager: sourceCellSchema,
    collectionCode: sourceCellSchema,
    contract: sourceCellSchema,
    insurer: sourceCellSchema,
    productName: sourceCellSchema,
    policyNumber: sourceCellSchema,
    contractedOn: sourceCellSchema,
    status: sourceCellSchema,
    finalPaymentMonth: sourceCellSchema,
    paymentSequence: sourceCellSchema,
    paymentPremium: sourceCellSchema,
    contractor: sourceCellSchema,
    insured: sourceCellSchema,
    coverageStartsOn: sourceCellSchema,
    coverageEndsOn: sourceCellSchema,
    collectionMethod: sourceCellSchema,
    paymentTerm: sourceCellSchema,
    originalRecruiterName: sourceCellSchema,
  })
  .strict();

export const ContractSourceRowSchema = z
  .object({
    sourceRow: z.number().int().min(2).max(2_147_483_647),
    format: ContractFileFormatSchema,
    cells: ContractSourceCellsSchema,
  })
  .strict();

const issueFieldSchema = z.union([
  z.enum(CONTRACT_SOURCE_FIELDS),
  z.literal("row"),
]);

export const ContractRowIssueSchema = z
  .object({
    sourceRow: z.number().int().min(2).max(2_147_483_647),
    field: issueFieldSchema,
    code: z.string().regex(/^[A-Za-z0-9_:-]{1,80}$/),
    message: z.string().min(1).max(300),
  })
  .strict();

export const ParsedImportFileSchema = z
  .object({
    basename: z
      .string()
      .min(1)
      .max(255)
      .refine((value) => !/[\\/\0]/.test(value), "basename is invalid"),
    format: ContractFileFormatSchema,
    rows: z.array(ContractSourceRowSchema).min(1).max(5_000),
    issues: z.array(ContractRowIssueSchema).max(105_000),
  })
  .strict()
  .superRefine((file, context) => {
    const sourceRows = new Set<number>();
    let previous = 1;
    file.rows.forEach((row, index) => {
      if (row.format !== file.format) {
        context.addIssue({
          code: "custom",
          message: "row format does not match file format",
          path: ["rows", index, "format"],
        });
      }
      if (row.sourceRow <= previous || sourceRows.has(row.sourceRow)) {
        context.addIssue({
          code: "custom",
          message: "source rows must be unique and ascending",
          path: ["rows", index, "sourceRow"],
        });
      }
      sourceRows.add(row.sourceRow);
      previous = row.sourceRow;
    });
    file.issues.forEach((issue, index) => {
      if (!sourceRows.has(issue.sourceRow)) {
        context.addIssue({
          code: "custom",
          message: "issue source row is unavailable",
          path: ["issues", index, "sourceRow"],
        });
      }
    });
  });

export function parseParsedImportFile(value: unknown): ParsedImportFile {
  const result = ParsedImportFileSchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeRepositoryError(
      "선택한 파일의 응답을 확인할 수 없습니다.",
      "invalid_response",
    );
  }
  return result.data;
}
