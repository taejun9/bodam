import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type { Family, FamilyMembership } from "../types/family";

export const FAMILY_IDS = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
] as const;
export const MEMBERSHIP_IDS = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
  "50000000-0000-4000-8000-000000000003",
  "50000000-0000-4000-8000-000000000004",
] as const;
export const CUSTOMER_IDS = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
] as const;
export const POLICY_IDS = [
  "70000000-0000-4000-8000-000000000001",
  "70000000-0000-4000-8000-000000000002",
  "70000000-0000-4000-8000-000000000003",
] as const;
export const TEST_TIMESTAMP = "2026-08-06T01:02:03.000Z";

export const family = (id: string, name = "합성 가족"): Family => ({
  id,
  name,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});

export const membership = (
  id: string,
  familyId: string,
  customerId: string,
  relationshipName: string | null = null,
): FamilyMembership => ({
  id,
  familyId,
  customerId,
  relationshipName,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});

export const customer = (id: string, name: string): Customer => ({
  id,
  name,
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});

export const policy = (
  id: string,
  customerId: string,
  monthlyPremiumWon: bigint,
  isIncluded = true,
): InsurancePolicy => ({
  id,
  customerId,
  insurer: "합성보험사",
  productName: "합성보험상품",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon,
  disclosurePlan: null,
  maturesOn: null,
  renewable: false,
  status: null,
  isIncluded,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});
