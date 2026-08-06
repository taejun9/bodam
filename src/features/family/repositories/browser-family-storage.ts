import { z } from "zod";

import {
  StoredFamilyMembershipSchema,
  StoredFamilySchema,
} from "../schemas/family-schema";
import { FamilyRepositoryError } from "../types/family-error";

export interface FamilyStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoredFamily = z.infer<typeof StoredFamilySchema>;
export type StoredFamilyMembership = z.infer<typeof StoredFamilyMembershipSchema>;

export const BROWSER_FAMILY_STORAGE_KEY = "bodam.preview.synthetic-families.v1";
export const BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY =
  "bodam.preview.synthetic-family-memberships.v1";

const hasUniqueKeys = <T>(items: readonly T[], keyOf: (item: T) => string): boolean => {
  const keys = new Set<string>();
  for (const item of items) {
    const key = keyOf(item);
    if (keys.has(key)) return false;
    keys.add(key);
  }
  return true;
};

const familyListSchema = z.array(StoredFamilySchema).refine(
  (families) => hasUniqueKeys(families, (family) => family.id),
);
const membershipListSchema = z
  .array(StoredFamilyMembershipSchema)
  .refine(
    (memberships) => hasUniqueKeys(memberships, (membership) => membership.id),
  )
  .refine(
    (memberships) => hasUniqueKeys(
      memberships,
      (membership) => `${membership.familyId}\u0000${membership.customerId}`,
    ),
  );

export class BrowserFamilyStorage {
  constructor(private readonly storage: FamilyStoragePort) {}

  loadFamilies(): StoredFamily[] {
    return this.load(BROWSER_FAMILY_STORAGE_KEY, familyListSchema, "가족");
  }

  saveFamilies(families: readonly StoredFamily[]): void {
    this.save(BROWSER_FAMILY_STORAGE_KEY, families, "가족");
  }

  loadMemberships(): StoredFamilyMembership[] {
    return this.load(
      BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY,
      membershipListSchema,
      "가족 구성원 관계",
    );
  }

  saveMemberships(memberships: readonly StoredFamilyMembership[]): void {
    this.save(BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY, memberships, "가족 구성원 관계");
  }

  private load<T>(key: string, schema: z.ZodType<T[]>, label: string): T[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(key);
    } catch {
      throw new FamilyRepositoryError(
        `미리보기 ${label} 저장소를 읽을 수 없습니다.`,
        "storage_unavailable",
      );
    }
    if (serialized === null) return [];

    try {
      const result = schema.safeParse(JSON.parse(serialized));
      if (result.success) return result.data;
    } catch {
      // Corrupt storage is reported without exposing its contents.
    }
    throw new FamilyRepositoryError(
      `저장된 미리보기 ${label} 데이터를 읽을 수 없습니다.`,
      "storage_corrupt",
    );
  }

  private save(key: string, value: unknown, label: string): void {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      throw new FamilyRepositoryError(
        `미리보기 ${label} 저장소에 저장할 수 없습니다.`,
        "storage_unavailable",
      );
    }
  }
}
