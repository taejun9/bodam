import { z } from "zod";

import {
  isUnicodeScalarText,
  trimEcmascriptWhitespace,
} from "@/shared/text-normalization";

import type {
  CoverageBenchmark,
  CoverageBenchmarkDeleteResult,
  CoverageBenchmarkInput,
  CoverageBenchmarkWire,
  CoverageBenchmarkWireInput,
} from "../types/coverage-benchmark";
import {
  CoverageBenchmarkRepositoryError,
  CoverageBenchmarkValidationError,
  type CoverageBenchmarkValidationIssue,
} from "../types/coverage-benchmark-error";

export const MAX_COVERAGE_BENCHMARK_GENDER_CHARS = 100;
export const MAX_COVERAGE_BENCHMARK_AGE_YEARS = 150;
export const MAX_COVERAGE_BENCHMARK_WON = 9_223_372_036_854_775_807n;

export const CoverageBenchmarkIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  "올바른 식별자가 필요합니다.",
);

const trimmedGenderSchema = z
  .string()
  .refine(isUnicodeScalarText, "성별은 유효한 Unicode 문자여야 합니다.")
  .transform(trimEcmascriptWhitespace)
  .pipe(z.string().min(1, "성별을 입력해 주세요."))
  .refine(
    (value) => Array.from(value).length <= MAX_COVERAGE_BENCHMARK_GENDER_CHARS,
    "성별은 100자 이내로 입력해 주세요.",
  );

const canonicalGenderSchema = z
  .string()
  .refine(isUnicodeScalarText, "성별은 유효한 Unicode 문자여야 합니다.")
  .min(1, "성별을 입력해 주세요.")
  .refine(
    (value) => value === trimEcmascriptWhitespace(value),
    "성별 형식이 올바르지 않습니다.",
  )
  .refine(
    (value) => Array.from(value).length <= MAX_COVERAGE_BENCHMARK_GENDER_CHARS,
    "성별은 100자 이내로 입력해 주세요.",
  );

const ageSchema = z
  .number()
  .int("나이는 정수로 입력해 주세요.")
  .min(0, "나이는 0 이상이어야 합니다.")
  .max(MAX_COVERAGE_BENCHMARK_AGE_YEARS, "나이는 150 이하여야 합니다.");

export const CoverageBenchmarkAmountSchema = z
  .bigint()
  .min(0n, "금액은 0 이상의 원 단위 정수여야 합니다.")
  .max(
    MAX_COVERAGE_BENCHMARK_WON,
    "금액이 저장 가능한 범위를 넘었습니다.",
  );

export const CoverageBenchmarkDecimalStringSchema = z
  .string()
  .regex(/^(0|[1-9][0-9]*)$/, "금액은 0 이상의 원 단위 정수여야 합니다.")
  .refine(
    (value) =>
      /^(0|[1-9][0-9]*)$/.test(value) &&
      BigInt(value) <= MAX_COVERAGE_BENCHMARK_WON,
    "금액이 저장 가능한 범위를 넘었습니다.",
  );

const utcMillisecondTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    "UTC millisecond timestamp가 필요합니다.",
  )
  .refine((value) => {
    try {
      return new Date(value).toISOString() === value;
    } catch {
      return false;
    }
  }, "실제 UTC millisecond timestamp가 필요합니다.");

const domainInputShape = {
  categoryId: CoverageBenchmarkIdSchema,
  gender: trimmedGenderSchema,
  minAgeYears: ageSchema,
  maxAgeYears: ageSchema,
  adequateMinWon: CoverageBenchmarkAmountSchema,
  excessiveMinWon: CoverageBenchmarkAmountSchema,
};

const domainResponseShape = {
  ...domainInputShape,
  gender: canonicalGenderSchema,
};

const wireInputShape = {
  ...domainResponseShape,
  adequateMinWon: CoverageBenchmarkDecimalStringSchema,
  excessiveMinWon: CoverageBenchmarkDecimalStringSchema,
};

type ThresholdFields = {
  minAgeYears: number;
  maxAgeYears: number;
  adequateMinWon: bigint | string;
  excessiveMinWon: bigint | string;
};

function validateRanges(value: ThresholdFields, context: z.RefinementCtx): void {
  if (value.minAgeYears > value.maxAgeYears) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["maxAgeYears"],
      message: "최대 나이는 최소 나이 이상이어야 합니다.",
    });
  }
  const adequate = typeof value.adequateMinWon === "bigint"
    ? value.adequateMinWon
    : /^(0|[1-9][0-9]*)$/.test(value.adequateMinWon)
      ? BigInt(value.adequateMinWon)
      : null;
  const excessive = typeof value.excessiveMinWon === "bigint"
    ? value.excessiveMinWon
    : /^(0|[1-9][0-9]*)$/.test(value.excessiveMinWon)
      ? BigInt(value.excessiveMinWon)
      : null;
  if (adequate !== null && excessive !== null && adequate >= excessive) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["excessiveMinWon"],
      message: "과다 하한은 적정 하한보다 커야 합니다.",
    });
  }
}

export const CoverageBenchmarkInputSchema = z
  .object(domainInputShape)
  .strict()
  .superRefine(validateRanges);

export const CoverageBenchmarkSchema = z
  .object({
    id: CoverageBenchmarkIdSchema,
    ...domainResponseShape,
    createdAt: utcMillisecondTimestampSchema,
    updatedAt: utcMillisecondTimestampSchema,
  })
  .strict()
  .superRefine(validateRanges);

export const CoverageBenchmarkWireInputSchema = z
  .object(wireInputShape)
  .strict()
  .superRefine(validateRanges);

export const CoverageBenchmarkWireSchema = z
  .object({
    id: CoverageBenchmarkIdSchema,
    ...wireInputShape,
    createdAt: utcMillisecondTimestampSchema,
    updatedAt: utcMillisecondTimestampSchema,
  })
  .strict()
  .superRefine(validateRanges);

export const StoredCoverageBenchmarkWireSchema = z
  .object({
    id: CoverageBenchmarkIdSchema,
    ...wireInputShape,
    createdAt: utcMillisecondTimestampSchema,
    updatedAt: utcMillisecondTimestampSchema,
    deletedAt: utcMillisecondTimestampSchema.nullable(),
  })
  .strict()
  .superRefine(validateRanges);

const deleteResultSchema = z
  .object({ id: CoverageBenchmarkIdSchema })
  .strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): CoverageBenchmarkValidationIssue[] =>
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
    throw new CoverageBenchmarkValidationError(
      validationIssues(result.error, fallbackField),
    );
  }
  return result.data;
}

const invalidResponse = (): CoverageBenchmarkRepositoryError =>
  new CoverageBenchmarkRepositoryError(
    "보장 비교 기준 데이터 응답을 확인할 수 없습니다.",
  );

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export const parseCoverageBenchmarkInput = (
  value: unknown,
): CoverageBenchmarkInput =>
  parseValidated(CoverageBenchmarkInputSchema, value);

export const parseCoverageBenchmarkId = (
  value: unknown,
  field = "id",
): string => parseValidated(CoverageBenchmarkIdSchema, value, field);

export const parseCoverageBenchmark = (value: unknown): CoverageBenchmark =>
  parseResponse(CoverageBenchmarkSchema, value);

export const parseCoverageBenchmarkList = (
  value: unknown,
): CoverageBenchmark[] =>
  parseResponse(z.array(CoverageBenchmarkSchema), value);

const wireToDomain = (wire: CoverageBenchmarkWire): CoverageBenchmark => ({
  ...wire,
  adequateMinWon: BigInt(wire.adequateMinWon),
  excessiveMinWon: BigInt(wire.excessiveMinWon),
});

export const parseCoverageBenchmarkWire = (value: unknown): CoverageBenchmark =>
  wireToDomain(parseResponse(CoverageBenchmarkWireSchema, value));

export const parseCoverageBenchmarkWireList = (
  value: unknown,
): CoverageBenchmark[] =>
  parseResponse(z.array(CoverageBenchmarkWireSchema), value).map(wireToDomain);

export function toCoverageBenchmarkWireInput(
  value: unknown,
): CoverageBenchmarkWireInput {
  const input = parseCoverageBenchmarkInput(value);
  return {
    ...input,
    adequateMinWon: input.adequateMinWon.toString(),
    excessiveMinWon: input.excessiveMinWon.toString(),
  };
}

export const parseCoverageBenchmarkDeleteResult = (
  value: unknown,
): CoverageBenchmarkDeleteResult => parseResponse(deleteResultSchema, value);
