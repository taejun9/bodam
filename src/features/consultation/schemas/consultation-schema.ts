import { z } from "zod";

import type {
  Consultation,
  ConsultationDeleteResult,
  ConsultationInput,
} from "../types/consultation";
import {
  ConsultationRepositoryError,
  ConsultationValidationError,
  type ConsultationValidationIssue,
} from "../types/consultation-error";

export const MAX_CONSULTATION_CONTENT_CHARS = 4_000;
export const MAX_CONSULTATION_RESULT_CHARS = 200;

export const ConsultationIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  "올바른 식별자가 필요합니다.",
);

const utcMillisecondTimestampSchema = z
  .string()
  .regex(
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/,
    "상담 일시는 UTC timestamp여야 합니다.",
  )
  .refine(
    (value) => {
      try {
        return new Date(value).toISOString() === value;
      } catch {
        return false;
      }
    },
    "상담 일시는 실제 UTC timestamp여야 합니다.",
  );

const consultedAtInputSchema = z
  .string()
  .datetime({ offset: true, message: "상담 일시는 timezone offset이 필요합니다." })
  .transform((value) => new Date(value).toISOString());

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
    "다음 연락일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다.",
  );

const nullableTextSchema = (label: string, maximum: number) =>
  z
    .union([z.string(), z.null()])
    .transform((value) => {
      if (value === null) return null;
      const normalized = value.trim();
      return normalized.length === 0 ? null : normalized;
    })
    .refine(
      (value) => value === null || Array.from(value).length <= maximum,
      `${label}은(는) ${maximum.toLocaleString("en-US")}자 이내로 입력해 주세요.`,
    );

const consultationInputShape = {
  consultedAt: consultedAtInputSchema,
  content: nullableTextSchema("상담 내용", MAX_CONSULTATION_CONTENT_CHARS),
  nextContactOn: nullableDateOnlySchema,
  result: nullableTextSchema("상담 결과", MAX_CONSULTATION_RESULT_CHARS),
};

const consultationResponseShape = {
  consultedAt: utcMillisecondTimestampSchema,
  content: nullableTextSchema("상담 내용", MAX_CONSULTATION_CONTENT_CHARS),
  nextContactOn: nullableDateOnlySchema,
  result: nullableTextSchema("상담 결과", MAX_CONSULTATION_RESULT_CHARS),
};

export const ConsultationInputSchema = z.object(consultationInputShape).strict();

export const ConsultationSchema = z
  .object({
    id: ConsultationIdSchema,
    customerId: ConsultationIdSchema,
    ...consultationResponseShape,
    createdAt: utcMillisecondTimestampSchema,
    updatedAt: utcMillisecondTimestampSchema,
  })
  .strict();

export const StoredConsultationSchema = ConsultationSchema.extend({
  deletedAt: utcMillisecondTimestampSchema.nullable(),
}).strict();

const consultationDeleteResultSchema = z
  .object({ id: ConsultationIdSchema })
  .strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): ConsultationValidationIssue[] =>
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
    throw new ConsultationValidationError(
      validationIssues(result.error, fallbackField),
    );
  }
  return result.data;
}

const invalidResponse = (): ConsultationRepositoryError =>
  new ConsultationRepositoryError("상담 데이터 응답을 확인할 수 없습니다.");

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export const parseConsultationInput = (value: unknown): ConsultationInput =>
  parseValidated(ConsultationInputSchema, value);

export const parseConsultationId = (value: unknown, field = "id"): string =>
  parseValidated(ConsultationIdSchema, value, field);

export const parseConsultedAt = (value: unknown): string =>
  parseValidated(consultedAtInputSchema, value, "consultedAt");

export const parseConsultation = (value: unknown): Consultation =>
  parseResponse(ConsultationSchema, value);

export const parseConsultationList = (value: unknown): Consultation[] =>
  parseResponse(z.array(ConsultationSchema), value);

export const parseConsultationDeleteResult = (
  value: unknown,
): ConsultationDeleteResult =>
  parseResponse(consultationDeleteResultSchema, value);
