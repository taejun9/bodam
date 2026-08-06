import { z } from "zod";

import {
  CALENDAR_VIEW_MAX_DATE,
  parseCalendarDate,
} from "@/shared/calendar-date";
import {
  isUnicodeScalarText,
  trimEcmascriptWhitespace,
} from "@/shared/text-normalization";

import type {
  Schedule,
  ScheduleDeleteResult,
  ScheduleInput,
  ScheduleQuery,
} from "../types/schedule";
import {
  ScheduleRepositoryError,
  ScheduleValidationError,
  type ScheduleValidationIssue,
} from "../types/schedule-error";

export const MAX_SCHEDULE_TITLE_CHARS = 200;
export const MAX_SCHEDULE_MEMO_CHARS = 4_000;

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const TIME_PATTERN = /^(?:[01]\d|2[0-3]):[0-5]\d$/;

const isCalendarDate = (value: string): boolean => {
  try {
    parseCalendarDate(value);
    return true;
  } catch {
    return false;
  }
};

const calendarDateSchema = (message: string) =>
  z.string().refine(isCalendarDate, message);

const scheduleDateSchema = (invalidMessage: string) =>
  calendarDateSchema(invalidMessage).refine(
    (value) => !isCalendarDate(value) || value <= CALENDAR_VIEW_MAX_DATE,
    `일정일은 ${CALENDAR_VIEW_MAX_DATE} 이하여야 합니다.`,
  );

const inputTitleSchema = z
  .string()
  .transform(trimEcmascriptWhitespace)
  .refine((value) => value.length > 0, "일정 제목을 입력해 주세요.")
  .refine(isUnicodeScalarText, "일정 제목은 유효한 Unicode 문자여야 합니다.")
  .refine(
    (value) => Array.from(value).length <= MAX_SCHEDULE_TITLE_CHARS,
    `일정 제목은 ${MAX_SCHEDULE_TITLE_CHARS}자 이내로 입력해 주세요.`,
  );

const canonicalTitleSchema = z
  .string()
  .min(1)
  .refine((value) => value === trimEcmascriptWhitespace(value))
  .refine(isUnicodeScalarText)
  .refine((value) => Array.from(value).length <= MAX_SCHEDULE_TITLE_CHARS);

const nullableInputTextSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const normalized = trimEcmascriptWhitespace(value);
    return normalized.length === 0 ? null : normalized;
  })
  .refine(
    (value) => value === null || isUnicodeScalarText(value),
    "메모는 유효한 Unicode 문자여야 합니다.",
  )
  .refine(
    (value) => value === null || Array.from(value).length <= MAX_SCHEDULE_MEMO_CHARS,
    `메모는 ${MAX_SCHEDULE_MEMO_CHARS.toLocaleString("en-US")}자 이내로 입력해 주세요.`,
  );

const canonicalNullableTextSchema = z.union([
  z.null(),
  z.string()
    .min(1)
    .refine((value) => value === trimEcmascriptWhitespace(value))
    .refine(isUnicodeScalarText)
    .refine((value) => Array.from(value).length <= MAX_SCHEDULE_MEMO_CHARS),
]);

const nullableInputTimeSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  })
  .refine(
    (value) => value === null || TIME_PATTERN.test(value),
    "시간은 HH:mm 형식의 실제 시간이어야 합니다.",
  );

const nullableInputCustomerIdSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  })
  .refine(
    (value) => value === null || UUID_PATTERN.test(value),
    "올바른 고객 식별자가 필요합니다.",
  );

export const ScheduleIdSchema = z.string().regex(
  UUID_PATTERN,
  "올바른 일정 식별자가 필요합니다.",
);

const scheduleInputShape = {
  title: inputTitleSchema,
  scheduledOn: z.string().transform((value) => value.trim()).pipe(
    scheduleDateSchema("일정일은 YYYY-MM-DD 형식의 실제 날짜여야 합니다."),
  ),
  scheduledTime: nullableInputTimeSchema,
  memo: nullableInputTextSchema,
  customerId: nullableInputCustomerIdSchema,
  isCompleted: z.boolean(),
};

const scheduleResponseShape = {
  title: canonicalTitleSchema,
  scheduledOn: scheduleDateSchema("일정일 응답을 확인할 수 없습니다."),
  scheduledTime: z.union([z.null(), z.string().regex(TIME_PATTERN)]),
  memo: canonicalNullableTextSchema,
  customerId: z.union([z.null(), z.string().regex(UUID_PATTERN)]),
  isCompleted: z.boolean(),
};

const utcMillisecondTimestampSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/)
  .refine((value) => {
    try {
      return new Date(value).toISOString() === value;
    } catch {
      return false;
    }
  });

export const ScheduleInputSchema = z.object(scheduleInputShape).strict();

export const ScheduleQuerySchema = z
  .object({
    startOn: z.string().transform((value) => value.trim()).pipe(
      calendarDateSchema("조회 시작일은 실제 날짜여야 합니다."),
    ),
    endBefore: z.string().transform((value) => value.trim()).pipe(
      calendarDateSchema("조회 종료일은 실제 날짜여야 합니다."),
    ),
  })
  .strict()
  .refine((query) => query.startOn < query.endBefore, {
    path: ["endBefore"],
    message: "조회 종료일은 시작일보다 뒤여야 합니다.",
  });

export const ScheduleSchema = z
  .object({
    id: ScheduleIdSchema,
    ...scheduleResponseShape,
    createdAt: utcMillisecondTimestampSchema,
    updatedAt: utcMillisecondTimestampSchema,
  })
  .strict();

export const StoredScheduleSchema = ScheduleSchema.extend({
  deletedAt: utcMillisecondTimestampSchema.nullable(),
}).strict();

const scheduleDeleteResultSchema = z.object({ id: ScheduleIdSchema }).strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): ScheduleValidationIssue[] =>
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
    throw new ScheduleValidationError(validationIssues(result.error, fallbackField));
  }
  return result.data;
}

const invalidResponse = (): ScheduleRepositoryError =>
  new ScheduleRepositoryError("일정 데이터 응답을 확인할 수 없습니다.");

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export const parseScheduleInput = (value: unknown): ScheduleInput =>
  parseValidated(ScheduleInputSchema, value);

export const parseScheduleQuery = (value: unknown): ScheduleQuery =>
  parseValidated(ScheduleQuerySchema, value);

export const parseScheduleId = (value: unknown, field = "id"): string =>
  parseValidated(ScheduleIdSchema, value, field);

export const parseScheduleIsCompleted = (value: unknown): boolean =>
  parseValidated(z.boolean(), value, "isCompleted");

export const parseSchedule = (value: unknown): Schedule =>
  parseResponse(ScheduleSchema, value);

export const parseScheduleList = (value: unknown): Schedule[] =>
  parseResponse(z.array(ScheduleSchema), value);

export const parseScheduleDeleteResult = (
  value: unknown,
): ScheduleDeleteResult => parseResponse(scheduleDeleteResultSchema, value);
