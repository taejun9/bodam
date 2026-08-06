import { z } from "zod";

import { isUnicodeScalarText } from "@/shared/text-normalization";

import {
  isBoundedUnicodeText,
  MAX_DOMAIN_TEXT_CHARS,
  MAX_SOURCE_CELL_CHARS,
  normalizeImportText,
} from "../services/contract-normalization";
import type {
  ImportContextQuery,
  ImportContextSnapshot,
} from "../types/import-preview";
import {
  DataExchangeApplicationError,
  DataExchangeRepositoryError,
} from "../types/data-exchange-error";

export const canonicalUuidSchema = z.string().regex(
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/,
);

export const importSnapshotTokenSchema = z.string().regex(/^[0-9a-f]{64}$/);

const normalizedTextSchema = (limit: number) =>
  z
    .string()
    .min(1)
    .refine((value) => isBoundedUnicodeText(value, limit))
    .refine((value) => normalizeImportText(value) === value);

const displayTextSchema = (limit: number) =>
  z
    .string()
    .min(1)
    .refine((value) => isBoundedUnicodeText(value, limit));

const existingCustomerNameSchema = z
  .string()
  .min(1)
  .refine(isUnicodeScalarText);

export const ImportDuplicateKeySchema = z
  .object({
    insurer: normalizedTextSchema(MAX_DOMAIN_TEXT_CHARS),
    policyNumber: normalizedTextSchema(MAX_SOURCE_CELL_CHARS),
  })
  .strict();

export const ImportContextQuerySchema: z.ZodType<ImportContextQuery> = z
  .object({
    keys: z.array(ImportDuplicateKeySchema).max(5_000),
  })
  .strict()
  .superRefine((query, context) => {
    const seen = new Set<string>();
    query.keys.forEach((key, index) => {
      const encoded = JSON.stringify([key.insurer, key.policyNumber]);
      if (seen.has(encoded)) {
        context.addIssue({
          code: "custom",
          message: "duplicate query key",
          path: ["keys", index],
        });
      }
      seen.add(encoded);
    });
  });

const customerSchema = z
  .object({
    id: canonicalUuidSchema,
    name: existingCustomerNameSchema,
  })
  .strict();

const duplicateCandidateSchema = ImportDuplicateKeySchema.extend({
  policyId: canonicalUuidSchema,
  customerId: canonicalUuidSchema,
  productName: displayTextSchema(MAX_DOMAIN_TEXT_CHARS),
}).strict();

export const ImportContextSnapshotSchema: z.ZodType<ImportContextSnapshot> = z
  .object({
    snapshotToken: importSnapshotTokenSchema,
    customers: z.array(customerSchema).max(100_000),
    duplicateCandidates: z.array(duplicateCandidateSchema).max(100_000),
  })
  .strict()
  .superRefine((snapshot, context) => {
    const customerIds = new Set<string>();
    snapshot.customers.forEach((customer, index) => {
      if (customerIds.has(customer.id)) {
        context.addIssue({
          code: "custom",
          message: "duplicate customer",
          path: ["customers", index, "id"],
        });
      }
      customerIds.add(customer.id);
    });

    const policyIds = new Set<string>();
    snapshot.duplicateCandidates.forEach((candidate, index) => {
      if (policyIds.has(candidate.policyId)) {
        context.addIssue({
          code: "custom",
          message: "duplicate policy candidate",
          path: ["duplicateCandidates", index, "policyId"],
        });
      }
      if (!customerIds.has(candidate.customerId)) {
        context.addIssue({
          code: "custom",
          message: "candidate customer is unavailable",
          path: ["duplicateCandidates", index, "customerId"],
        });
      }
      policyIds.add(candidate.policyId);
    });
  });

export function parseImportContextQuery(value: unknown): ImportContextQuery {
  const result = ImportContextQuerySchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeApplicationError(
      "가져오기 중복 기준을 만들 수 없습니다.",
      "invalid_response",
    );
  }
  return result.data;
}

export function parseImportContextSnapshot(value: unknown): ImportContextSnapshot {
  const result = ImportContextSnapshotSchema.safeParse(value);
  if (!result.success) {
    throw new DataExchangeRepositoryError(
      "가져오기 기준 정보를 확인할 수 없습니다.",
      "invalid_response",
    );
  }
  return result.data;
}
