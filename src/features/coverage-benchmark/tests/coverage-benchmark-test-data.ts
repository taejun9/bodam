import type { Coverage, CoverageCategory } from "@/features/coverage/types/coverage";
import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";

export const timestamp = "2026-08-06T01:02:03.000Z";
export const customerId = "11111111-1111-4111-8111-111111111111";
export const categoryIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
] as const;
export const benchmarkIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
  "30000000-0000-4000-8000-000000000004",
  "30000000-0000-4000-8000-000000000005",
] as const;
export const policyIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
] as const;

export const categories: CoverageCategory[] = categoryIds.map((id, index) => ({
  id,
  name: `합성 카테고리 ${index + 1}`,
  createdAt: timestamp,
  updatedAt: timestamp,
}));

export const customer: Customer = {
  id: customerId,
  name: "합성 고객",
  birthDate: "2000-08-06",
  gender: "합성 성별",
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};

export const policy = (id: string, isIncluded: boolean): InsurancePolicy => ({
  id,
  customerId,
  insurer: "합성보험사",
  productName: "합성상품",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon: 1n,
  disclosurePlan: null,
  maturesOn: null,
  renewable: false,
  status: null,
  isIncluded,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const coverage = (
  id: string,
  policyId: string,
  categoryId: string,
  amountWon: bigint,
): Coverage => ({
  id,
  policyId,
  categoryId,
  amountWon,
  createdAt: timestamp,
  updatedAt: timestamp,
});

export const benchmarkInput = (
  overrides: Partial<CoverageBenchmarkInput> = {},
): CoverageBenchmarkInput => ({
  categoryId: categoryIds[0],
  gender: "합성 성별",
  minAgeYears: 20,
  maxAgeYears: 29,
  adequateMinWon: 50n,
  excessiveMinWon: 100n,
  ...overrides,
});

export const benchmark = (
  id: string,
  overrides: Partial<CoverageBenchmarkInput> = {},
): CoverageBenchmark => ({
  id,
  ...benchmarkInput(overrides),
  createdAt: timestamp,
  updatedAt: timestamp,
});
