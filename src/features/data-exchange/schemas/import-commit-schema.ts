import { z } from "zod";

import {
  canonicalPremium,
  isBoundedUnicodeText,
  isCalendarDate,
  MAX_DOMAIN_TEXT_CHARS,
  MAX_SOURCE_CELL_CHARS,
  normalizeImportText,
} from "../services/contract-normalization";
import type {
  ImportCommitDraft,
  ImportCommitRequest,
  ImportCommitResult,
} from "../types/import-commit";
import {
  DataExchangeRepositoryError,
  DataExchangeValidationError,
} from "../types/data-exchange-error";
import { ContractFileFormatSchema, ContractSourceRowSchema } from "./contract-source-schema";
import {
  canonicalUuidSchema,
  importSnapshotTokenSchema,
} from "./import-context-schema";

const clientKeySchema = canonicalUuidSchema;
const normalizedTextSchema = (limit: number) =>
  z
    .string()
    .min(1)
    .refine((value) => isBoundedUnicodeText(value, limit))
    .refine((value) => normalizeImportText(value) === value);
const dateSchema = z.string().refine(isCalendarDate).nullable();
const optionalDomainTextSchema = normalizedTextSchema(MAX_DOMAIN_TEXT_CHARS).nullable();

export const MappedContractPolicySchema = z
  .object({
    insurer: normalizedTextSchema(MAX_DOMAIN_TEXT_CHARS),
    productName: normalizedTextSchema(MAX_DOMAIN_TEXT_CHARS),
    joinedOn: dateSchema,
    status: optionalDomainTextSchema,
    monthlyPremiumWon: z
      .string()
      .refine((value) => canonicalPremium(value) === value),
    maturesOn: dateSchema,
    paymentTerm: optionalDomainTextSchema,
    coverageTerm: z.null(),
    disclosurePlan: z.null(),
    renewable: z.literal(false),
    isIncluded: z.literal(true),
  })
  .strict();

const customerReferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), customerId: canonicalUuidSchema }).strict(),
  z.object({ kind: z.literal("new"), clientKey: clientKeySchema }).strict(),
]);

export const ImportRowDecisionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("create"), customer: customerReferenceSchema }).strict(),
  z.object({ action: z.literal("separateCreate"), customer: customerReferenceSchema }).strict(),
  z.object({ action: z.literal("update"), targetPolicyId: canonicalUuidSchema }).strict(),
  z.object({ action: z.literal("skip") }).strict(),
]);

const newCustomerSchema = z
  .object({
    clientKey: clientKeySchema,
    name: z
      .string()
      .transform(normalizeImportText)
      .pipe(
        z
          .string()
          .min(1)
          .refine((value) => isBoundedUnicodeText(value, MAX_SOURCE_CELL_CHARS)),
      ),
  })
  .strict();

export const ImportCommitDraftSchema: z.ZodType<ImportCommitDraft> = z
  .object({
    previewId: canonicalUuidSchema,
    newCustomers: z.array(newCustomerSchema).max(5_000),
    rows: z
      .array(
        z
          .object({
            sourceRow: z.number().int().min(2).max(2_147_483_647),
            decision: ImportRowDecisionSchema,
          })
          .strict(),
      )
      .max(5_000),
  })
  .strict()
  .superRefine((draft, context) => {
    addDuplicateIssues(draft.newCustomers.map(({ clientKey }) => clientKey), "newCustomers", context);
    addDuplicateIssues(draft.rows.map(({ sourceRow }) => sourceRow), "rows", context);
  });

const commitSummaryShape = {
  totalRows: z.number().int().min(1).max(5_000),
  invalidRows: z.number().int().min(0).max(5_000),
  unselectedRows: z.number().int().min(0).max(5_000),
};

export const ImportCommitRequestSchema: z.ZodType<ImportCommitRequest> = z
  .object({
    previewId: canonicalUuidSchema,
    snapshotToken: importSnapshotTokenSchema,
    format: ContractFileFormatSchema,
    newCustomers: z.array(newCustomerSchema).max(5_000),
    rows: z
      .array(
        z
          .object({
            source: ContractSourceRowSchema,
            mapped: MappedContractPolicySchema,
            decision: ImportRowDecisionSchema,
          })
          .strict(),
      )
      .max(5_000),
    summary: z.object(commitSummaryShape).strict(),
  })
  .strict()
  .superRefine((request, context) => {
    addDuplicateIssues(request.newCustomers.map(({ clientKey }) => clientKey), "newCustomers", context);
    addDuplicateIssues(request.rows.map(({ source }) => source.sourceRow), "rows", context);
    request.rows.forEach((row, index) => {
      if (row.source.format !== request.format) {
        context.addIssue({ code: "custom", message: "format mismatch", path: ["rows", index] });
      }
    });
  });

const outcomeSchema = z
  .object({
    sourceRow: z.number().int().min(2).max(2_147_483_647),
    outcome: z.enum(["created", "updated", "skipped"]),
    policyId: canonicalUuidSchema.nullable(),
  })
  .strict();

export const ImportCommitResultSchema: z.ZodType<ImportCommitResult> = z
  .object({
    ...commitSummaryShape,
    created: z.number().int().min(0).max(5_000),
    updated: z.number().int().min(0).max(5_000),
    skipped: z.number().int().min(0).max(5_000),
    outcomes: z.array(outcomeSchema).max(5_000),
  })
  .strict();

export function parseImportCommitDraft(value: unknown): ImportCommitDraft {
  const result = ImportCommitDraftSchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeValidationError([
      { field: "commit", message: "가져오기 선택 내용을 확인해 주세요." },
    ]);
  }
  return result.data;
}

export function parseImportCommitRequest(value: unknown): ImportCommitRequest {
  const result = ImportCommitRequestSchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeValidationError([
      { field: "commit", message: "가져오기 선택 내용을 확인해 주세요." },
    ]);
  }
  return result.data;
}

export function parseImportCommitResult(value: unknown): ImportCommitResult {
  const result = ImportCommitResultSchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeRepositoryError(
      "가져오기 반영 결과를 확인할 수 없습니다.",
      "invalid_response",
    );
  }
  return result.data;
}

function addDuplicateIssues(
  values: readonly (string | number)[],
  path: string,
  context: z.RefinementCtx,
): void {
  const seen = new Set<string | number>();
  values.forEach((value, index) => {
    if (seen.has(value)) {
      context.addIssue({ code: "custom", message: "duplicate value", path: [path, index] });
    }
    seen.add(value);
  });
}
