import {
  FamilyMembershipSchema,
  FamilySchema,
  StoredFamilyMembershipSchema,
  StoredFamilySchema,
  parseFamily,
  parseFamilyMembership,
} from "../schemas/family-schema";
import type { Family, FamilyMembership } from "../types/family";
import { FamilyRepositoryError } from "../types/family-error";
import type {
  StoredFamily,
  StoredFamilyMembership,
} from "./browser-family-storage";

export function parseStoredFamily(value: unknown): StoredFamily {
  const result = StoredFamilySchema.safeParse(value);
  if (!result.success) {
    throw new FamilyRepositoryError("가족 데이터를 저장할 수 없습니다.");
  }
  return result.data;
}

export function parseStoredMembership(value: unknown): StoredFamilyMembership {
  const result = StoredFamilyMembershipSchema.safeParse(value);
  if (!result.success) {
    throw new FamilyRepositoryError("가족 구성원 관계를 저장할 수 없습니다.");
  }
  return result.data;
}

export function familyFromStored(family: StoredFamily): Family {
  return parseFamily(FamilySchema.parse({
    id: family.id,
    name: family.name,
    createdAt: family.createdAt,
    updatedAt: family.updatedAt,
  }));
}

export function membershipFromStored(
  membership: StoredFamilyMembership,
): FamilyMembership {
  return parseFamilyMembership(FamilyMembershipSchema.parse({
    id: membership.id,
    familyId: membership.familyId,
    customerId: membership.customerId,
    relationshipName: membership.relationshipName,
    createdAt: membership.createdAt,
    updatedAt: membership.updatedAt,
  }));
}
