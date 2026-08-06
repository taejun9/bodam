import { z } from "zod";

import type {
  Family,
  FamilyCustomerOption,
  FamilyDetail,
  FamilyInput,
  FamilyMembership,
  FamilyMembershipInput,
  FamilyMembershipUpdateInput,
  FamilySummary,
} from "../types/family";
import {
  FamilyRepositoryError,
  FamilyValidationError,
  type FamilyValidationIssue,
} from "../types/family-error";

export const MAX_FAMILY_TEXT_CHARS = 100;

const withinTextLimit = (value: string): boolean =>
  Array.from(value).length <= MAX_FAMILY_TEXT_CHARS;

export const FamilyIdSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
  "올바른 식별자가 필요합니다.",
);

const familyNameSchema = z
  .string()
  .transform((value) => value.trim())
  .pipe(z.string().min(1, "가족 이름을 입력해 주세요."))
  .refine(withinTextLimit, "가족 이름은 100자 이내로 입력해 주세요.");

const relationshipNameSchema = z
  .union([z.string(), z.null()])
  .transform((value) => {
    if (value === null) return null;
    const normalized = value.trim();
    return normalized.length === 0 ? null : normalized;
  })
  .refine(
    (value) => value === null || withinTextLimit(value),
    "관계명은 100자 이내로 입력해 주세요.",
  );

const timestampSchema = z.string().datetime({ offset: true });
const familyInputShape = { name: familyNameSchema };
const membershipInputShape = {
  customerId: FamilyIdSchema,
  relationshipName: relationshipNameSchema,
};

export const FamilyInputSchema = z.object(familyInputShape).strict();
export const FamilyMembershipInputSchema = z.object(membershipInputShape).strict();
export const FamilyMembershipUpdateInputSchema = z
  .object({ relationshipName: relationshipNameSchema })
  .strict();

export const FamilySchema = z
  .object({
    id: FamilyIdSchema,
    ...familyInputShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const FamilyMembershipSchema = z
  .object({
    id: FamilyIdSchema,
    familyId: FamilyIdSchema,
    ...membershipInputShape,
    createdAt: timestampSchema,
    updatedAt: timestampSchema,
  })
  .strict();

export const StoredFamilySchema = FamilySchema.extend({
  deletedAt: timestampSchema.nullable(),
}).strict();

export const StoredFamilyMembershipSchema = FamilyMembershipSchema.extend({
  deletedAt: timestampSchema.nullable(),
}).strict();

export const FamilySummarySchema = z
  .object({
    family: FamilySchema,
    memberCount: z.number().int().nonnegative(),
    totalMonthlyPremiumWon: z.bigint().nonnegative(),
  })
  .strict();

export const FamilyMemberViewSchema = z
  .object({
    membershipId: FamilyIdSchema,
    customerId: FamilyIdSchema,
    customerName: z.string().min(1),
    relationshipName: relationshipNameSchema,
    totalMonthlyPremiumWon: z.bigint().nonnegative(),
    includedPolicyCount: z.number().int().nonnegative(),
  })
  .strict();

export const FamilyDetailSchema = z
  .object({
    family: FamilySchema,
    members: z.array(FamilyMemberViewSchema),
    totalMonthlyPremiumWon: z.bigint().nonnegative(),
  })
  .strict();

export const FamilyCustomerOptionSchema = z
  .object({ id: FamilyIdSchema, name: z.string().min(1) })
  .strict();

const deleteResultSchema = z.object({ id: FamilyIdSchema }).strict();

const validationIssues = (
  error: z.ZodError,
  fallbackField?: string,
): FamilyValidationIssue[] =>
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
    throw new FamilyValidationError(validationIssues(result.error, fallbackField));
  }
  return result.data;
}

const invalidResponse = (): FamilyRepositoryError =>
  new FamilyRepositoryError("가족 데이터 응답을 확인할 수 없습니다.");

function parseResponse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) throw invalidResponse();
  return result.data;
}

export const parseFamilyInput = (value: unknown): FamilyInput =>
  parseValidated(FamilyInputSchema, value);

export const parseFamilyMembershipInput = (value: unknown): FamilyMembershipInput =>
  parseValidated(FamilyMembershipInputSchema, value);

export const parseFamilyMembershipUpdateInput = (
  value: unknown,
): FamilyMembershipUpdateInput =>
  parseValidated(FamilyMembershipUpdateInputSchema, value);

export const parseFamilyId = (value: unknown, field = "id"): string =>
  parseValidated(FamilyIdSchema, value, field);

export const parseFamilySearch = (value: unknown): string =>
  parseValidated(
    z
      .string()
      .transform((search) => search.trim())
      .refine(withinTextLimit, "검색어는 100자 이내로 입력해 주세요."),
    value,
    "search",
  );

export const parseFamily = (value: unknown): Family =>
  parseResponse(FamilySchema, value);

export const parseFamilyList = (value: unknown): Family[] =>
  parseResponse(z.array(FamilySchema), value);

export const parseFamilyMembership = (value: unknown): FamilyMembership =>
  parseResponse(FamilyMembershipSchema, value);

export const parseFamilyMembershipList = (value: unknown): FamilyMembership[] =>
  parseResponse(z.array(FamilyMembershipSchema), value);

export const parseFamilySummaryList = (value: unknown): FamilySummary[] =>
  parseResponse(z.array(FamilySummarySchema), value);

export const parseFamilyDetail = (value: unknown): FamilyDetail =>
  parseResponse(FamilyDetailSchema, value);

export const parseFamilyCustomerOptionList = (
  value: unknown,
): FamilyCustomerOption[] =>
  parseResponse(z.array(FamilyCustomerOptionSchema), value);

export const parseFamilyDeleteResult = (value: unknown): { readonly id: string } =>
  parseResponse(deleteResultSchema, value);
