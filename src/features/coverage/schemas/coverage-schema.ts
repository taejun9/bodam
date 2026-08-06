import { z } from "zod";

import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
  CoverageDeleteResult,
  CoverageInput,
  CoverageWire,
  CoverageWireInput,
} from "../types/coverage";
import {
  CoverageRepositoryError,
  CoverageValidationError,
  type CoverageValidationIssue,
} from "../types/coverage-error";

export const MAX_COVERAGE_CATEGORY_CHARS = 100;
export const MAX_COVERAGE_AMOUNT_WON = 9_223_372_036_854_775_807n;

const canonicalUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  "올바른 식별자가 필요합니다.",
);

const categoryNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, "카테고리 이름을 입력해 주세요."))
  .refine(
    (value) => Array.from(value).length <= MAX_COVERAGE_CATEGORY_CHARS,
    "카테고리 이름은 100자 이내로 입력해 주세요.",
  );

export const CoverageAmountSchema = z
  .bigint()
  .min(0n, "보장금액은 0 이상의 원 단위 정수여야 합니다.")
  .max(MAX_COVERAGE_AMOUNT_WON, "보장금액이 저장 가능한 범위를 넘었습니다.");

export const CoverageDecimalStringSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "보장금액은 0 이상의 원 단위 정수여야 합니다.")
  .refine(
    (value) =>
      /^(0|[1-9][0-9]*)$/.test(value) &&
      BigInt(value) <= MAX_COVERAGE_AMOUNT_WON,
    "보장금액이 저장 가능한 범위를 넘었습니다.",
  );

const timestampSchema = z.string().datetime({ offset: true });
const categoryInputShape = { name: categoryNameSchema };
const coverageInputShape = {
  categoryId: canonicalUuidSchema,
  amountWon: CoverageAmountSchema,
};
const coverageWireInputShape = {
  categoryId: canonicalUuidSchema,
  amountWon: CoverageDecimalStringSchema,
};

export const CoverageCategoryInputSchema = z.object(categoryInputShape).strict();
export const CoverageInputSchema = z.object(coverageInputShape).strict();
export const CoverageWireInputSchema = z.object(coverageWireInputShape).strict();

export const CoverageCategorySchema = z
  .object({
    id: canonicalUuidSchema,
    ...categoryInputShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const CoverageSchema = z
  .object({
    id: canonicalUuidSchema,
    policyId: canonicalUuidSchema,
    ...coverageInputShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const CoverageWireSchema = z
  .object({
    id: canonicalUuidSchema,
    policyId: canonicalUuidSchema,
    ...coverageWireInputShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const StoredCoverageCategorySchema = CoverageCategorySchema.extend({
  deletedAt: timestampSchema.nullable(),
}).strict();

export const StoredCoverageWireSchema = CoverageWireSchema.extend({
  deletedAt: timestampSchema.nullable(),
}).strict();

export const CoverageDeleteResultSchema = z
  .object({ id: canonicalUuidSchema })
  .strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): CoverageValidationIssue[] =>
  error.issues.map((issue) => ({
    field: issue.path.join(".") || fallbackField || "input",
    message: issue.message,
  }));

function parseValidated<T>(
  schema: z.ZodType<T>,
  value: unknown,
  fallbackField?: string,
): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new CoverageValidationError(validationIssues(result.error, fallbackField));
  }
  return result.data;
}

export const parseCoverageCategoryInput = (value: unknown): CoverageCategoryInput =>
  parseValidated(CoverageCategoryInputSchema, value);

export const parseCoverageInput = (value: unknown): CoverageInput =>
  parseValidated(CoverageInputSchema, value);

export const parseCoverageCustomerId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "customerId");

export const parseCoveragePolicyId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "policyId");

export const parseCoverageCategoryId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "categoryId");

export const parseCoverageId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "id");

const invalidResponse = (): CoverageRepositoryError =>
  new CoverageRepositoryError("보장 데이터 응답을 확인할 수 없습니다.");

export function parseCoverageCategory(value: unknown): CoverageCategory {
  const result = CoverageCategorySchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export function parseCoverageCategoryList(value: unknown): CoverageCategory[] {
  const result = z.array(CoverageCategorySchema).safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export function parseCoverage(value: unknown): Coverage {
  const result = CoverageSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export function parseCoverageList(value: unknown): Coverage[] {
  const result = z.array(CoverageSchema).safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

function wireToDomain(coverage: CoverageWire): Coverage {
  return { ...coverage, amountWon: BigInt(coverage.amountWon) };
}

export function parseCoverageWire(value: unknown): Coverage {
  const result = CoverageWireSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return wireToDomain(result.data as CoverageWire);
}

export function parseCoverageWireList(value: unknown): Coverage[] {
  const result = z.array(CoverageWireSchema).safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.map((coverage) => wireToDomain(coverage as CoverageWire));
}

export function toCoverageWireInput(value: unknown): CoverageWireInput {
  const input = parseCoverageInput(value);
  return { ...input, amountWon: input.amountWon.toString() };
}

export function parseCoverageDeleteResult(value: unknown): CoverageDeleteResult {
  const result = CoverageDeleteResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}
