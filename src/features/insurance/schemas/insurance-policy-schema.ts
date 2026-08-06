import { z } from "zod";

import type {
  InsurancePolicy,
  InsurancePolicyDeleteResult,
  InsurancePolicyInput,
  InsurancePolicyWire,
  InsurancePolicyWireInput,
} from "../types/insurance-policy";
import {
  InsuranceRepositoryError,
  InsuranceValidationError,
  type InsuranceValidationIssue,
} from "../types/insurance-error";

export const MAX_INSURANCE_TEXT_CHARS = 200;
export const MAX_SQLITE_INTEGER = 9_223_372_036_854_775_807n;

const canonicalUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  "올바른 식별자가 필요합니다.",
);

const withinTextLimit = (value: string): boolean =>
  Array.from(value).length <= MAX_INSURANCE_TEXT_CHARS;

const requiredTextSchema = (label: string) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().min(1, `${label}을(를) 입력해 주세요.`))
    .refine(withinTextLimit, `${label}은(는) 200자 이내로 입력해 주세요.`);

const nullableTextSchema = (label: string) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const normalized = value.trim();
      return normalized.length === 0 ? null : normalized;
    })
    .refine(
      (value) => value === null || withinTextLimit(value),
      `${label}은(는) 200자 이내로 입력해 주세요.`,
    );

const isCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const nullableDateOnlySchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  })
  .refine(
    (value) => value === null || isCalendarDate(value),
    "날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.",
  );

export const KrwAmountSchema = z
  .bigint()
  .min(0n, "월보험료는 0 이상의 원 단위 정수여야 합니다.")
  .max(MAX_SQLITE_INTEGER, "월보험료가 저장 가능한 범위를 넘었습니다.");

export const KrwDecimalStringSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "월보험료는 0 이상의 원 단위 정수여야 합니다.")
  .refine(
    (value) =>
      /^(0|[1-9][0-9]*)$/.test(value) &&
      BigInt(value) <= MAX_SQLITE_INTEGER,
    "월보험료가 저장 가능한 범위를 넘었습니다.",
  );

const domainInputShape = {
  insurer: requiredTextSchema("보험사"),
  productName: requiredTextSchema("상품명"),
  joinedOn: nullableDateOnlySchema,
  coverageTerm: nullableTextSchema("보험기간"),
  paymentTerm: nullableTextSchema("납입기간"),
  monthlyPremiumWon: KrwAmountSchema,
  disclosurePlan: nullableTextSchema("고지플랜"),
  maturesOn: nullableDateOnlySchema,
  renewable: z.boolean(),
  status: nullableTextSchema("계약 상태"),
  isIncluded: z.boolean(),
};

const wireInputShape = {
  ...domainInputShape,
  monthlyPremiumWon: KrwDecimalStringSchema,
};

export const InsurancePolicyInputSchema = z.object(domainInputShape).strict();
export const InsurancePolicyWireInputSchema = z.object(wireInputShape).strict();

export const InsurancePolicySchema = z
  .object({
    id: canonicalUuidSchema,
    customerId: canonicalUuidSchema,
    ...domainInputShape,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const InsurancePolicyWireSchema = z
  .object({
    id: canonicalUuidSchema,
    customerId: canonicalUuidSchema,
    ...wireInputShape,
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export const StoredInsurancePolicyWireSchema = InsurancePolicyWireSchema.extend({
  deletedAt: z.string().datetime({ offset: true }).nullable(),
}).strict();

export const InsurancePolicyDeleteResultSchema = z
  .object({ id: canonicalUuidSchema })
  .strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): InsuranceValidationIssue[] =>
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
    throw new InsuranceValidationError(validationIssues(result.error, fallbackField));
  }
  return result.data;
}

export const parseInsurancePolicyInput = (value: unknown): InsurancePolicyInput =>
  parseValidated(InsurancePolicyInputSchema, value);

export const parseInsuranceCustomerId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "customerId");

export const parseInsurancePolicyId = (value: unknown): string =>
  parseValidated(canonicalUuidSchema, value, "id");

export const parseMonthlyPremiumWon = (value: unknown): bigint =>
  BigInt(parseValidated(KrwDecimalStringSchema, value, "monthlyPremiumWon"));

const invalidResponse = (): InsuranceRepositoryError =>
  new InsuranceRepositoryError("보험계약 데이터 응답을 확인할 수 없습니다.");

export function parseInsurancePolicy(value: unknown): InsurancePolicy {
  const result = InsurancePolicySchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export function parseInsurancePolicyList(value: unknown): InsurancePolicy[] {
  const result = z.array(InsurancePolicySchema).safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

function wireToDomain(policy: InsurancePolicyWire): InsurancePolicy {
  return {
    ...policy,
    monthlyPremiumWon: BigInt(policy.monthlyPremiumWon),
  };
}

export function parseInsurancePolicyWire(value: unknown): InsurancePolicy {
  const result = InsurancePolicyWireSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return wireToDomain(result.data as InsurancePolicyWire);
}

export function parseInsurancePolicyWireList(value: unknown): InsurancePolicy[] {
  const result = z.array(InsurancePolicyWireSchema).safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data.map((policy) => wireToDomain(policy as InsurancePolicyWire));
}

export function toInsurancePolicyWireInput(value: unknown): InsurancePolicyWireInput {
  const input = parseInsurancePolicyInput(value);
  return {
    ...input,
    monthlyPremiumWon: input.monthlyPremiumWon.toString(),
  };
}

export function parseInsurancePolicyDeleteResult(
  value: unknown,
): InsurancePolicyDeleteResult {
  const result = InsurancePolicyDeleteResultSchema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}
