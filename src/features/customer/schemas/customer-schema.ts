import { z } from "zod";

import {
  isUnicodeScalarText,
  trimEcmascriptWhitespace,
} from "@/shared/text-normalization";

import type {
  Customer,
  CustomerDeleteResult,
  CustomerInput,
  CustomerQuery,
} from "../types/customer";
import {
  CustomerRepositoryError,
  CustomerValidationError,
  type CustomerValidationIssue,
} from "../types/customer-error";

const nullableTextSchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = trimEcmascriptWhitespace(value);
    return trimmed.length === 0 ? null : trimmed;
  }

  return value;
}, z.string().nullable());

const isCalendarDate = (value: string): boolean => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
};

const nullableDateOnlySchema = z.preprocess((value) => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  return value;
}, z.string().refine(isCalendarDate, "날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.").nullable());

const customerNameSchema = z.string().trim().min(1, "이름을 입력해 주세요.");
const customerIdSchema = z.string().trim().min(1, "고객 식별자가 필요합니다.");
const timestampSchema = z.string().datetime({ offset: true });
const customerSearchSchema = nullableTextSchema.refine(
  (value) => value === null || Array.from(value).length <= 100,
  "검색어는 100자 이내로 입력해 주세요.",
);
const nullableGenderSchema = nullableTextSchema.refine(
  (value) => value === null || isUnicodeScalarText(value),
  "성별은 유효한 Unicode 문자여야 합니다.",
);

const customerInputShape = {
  name: customerNameSchema,
  birthDate: nullableDateOnlySchema,
  gender: nullableGenderSchema,
  phone: nullableTextSchema,
  address: nullableTextSchema,
  memo: nullableTextSchema,
  status: nullableTextSchema,
};

export const CustomerCreateInputSchema = z
  .object({
    ...customerInputShape,
    isManaged: z.boolean().default(true),
  })
  .strict();

export const CustomerUpdateInputSchema = z
  .object({
    ...customerInputShape,
    isManaged: z.boolean(),
  })
  .strict();

export const CustomerQuerySchema = z
  .object({
    search: customerSearchSchema,
  })
  .strict();

export const CustomerSchema = z
  .object({
    id: customerIdSchema,
    ...customerInputShape,
    isManaged: z.boolean(),
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const CustomerListSchema = z.array(CustomerSchema);

export const CustomerDeleteResultSchema = z
  .object({
    id: customerIdSchema,
  })
  .strict();

export const StoredCustomerSchema = CustomerSchema.extend({
  deletedAt: timestampSchema.nullable(),
});

const validationIssues = (error: z.ZodError): CustomerValidationIssue[] =>
  error.issues.map((issue) => ({
    field: issue.path.join("."),
    message: issue.message,
  }));

const parseInput = (schema: z.ZodType, value: unknown): CustomerInput => {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new CustomerValidationError(validationIssues(result.error));
  }
  return result.data as CustomerInput;
};

export const parseCustomerCreateInput = (value: unknown): CustomerInput =>
  parseInput(CustomerCreateInputSchema, value);

export const parseCustomerUpdateInput = (value: unknown): CustomerInput =>
  parseInput(CustomerUpdateInputSchema, value);

export const parseCustomerQuery = (value: unknown): CustomerQuery => {
  const result = CustomerQuerySchema.safeParse(value);
  if (!result.success) {
    throw new CustomerValidationError(validationIssues(result.error));
  }
  return result.data;
};

export const parseCustomerId = (value: unknown): string => {
  const result = customerIdSchema.safeParse(value);
  if (!result.success) {
    throw new CustomerValidationError(validationIssues(result.error));
  }
  return result.data;
};

const invalidResponse = (): CustomerRepositoryError =>
  new CustomerRepositoryError("고객 데이터 응답을 확인할 수 없습니다.");

export const parseCustomer = (value: unknown): Customer => {
  const result = CustomerSchema.safeParse(value);
  if (!result.success) {
    throw invalidResponse();
  }
  return result.data;
};

export const parseCustomerList = (value: unknown): Customer[] => {
  const result = CustomerListSchema.safeParse(value);
  if (!result.success) {
    throw invalidResponse();
  }
  return result.data;
};

export const parseCustomerDeleteResult = (value: unknown): CustomerDeleteResult => {
  const result = CustomerDeleteResultSchema.safeParse(value);
  if (!result.success) {
    throw invalidResponse();
  }
  return result.data;
};
