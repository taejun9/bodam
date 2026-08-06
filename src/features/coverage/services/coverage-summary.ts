import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type {
  Coverage,
  CoverageCategory,
  CoverageSummary,
} from "../types/coverage";

export function calculateCoverageSummary(
  categories: readonly CoverageCategory[],
  policies: readonly InsurancePolicy[],
  coverages: readonly Coverage[],
): CoverageSummary[] {
  const includedPolicyIds = new Set(
    policies.filter((policy) => policy.isIncluded).map((policy) => policy.id),
  );
  const totals = new Map<string, { amountWon: bigint; coverageCount: number }>();

  for (const coverage of coverages) {
    if (!includedPolicyIds.has(coverage.policyId)) continue;
    const current = totals.get(coverage.categoryId) ?? {
      amountWon: 0n,
      coverageCount: 0,
    };
    totals.set(coverage.categoryId, {
      amountWon: current.amountWon + coverage.amountWon,
      coverageCount: current.coverageCount + 1,
    });
  }

  return categories.flatMap((category) => {
    const total = totals.get(category.id);
    return total === undefined
      ? []
      : [{
          categoryId: category.id,
          categoryName: category.name,
          amountWon: total.amountWon,
          coverageCount: total.coverageCount,
        }];
  });
}

export function coveragesForPolicy(
  coverages: readonly Coverage[],
  policyId: string,
): Coverage[] {
  return coverages.filter((coverage) => coverage.policyId === policyId);
}

export function countCategoryUsage(
  coverages: readonly Coverage[],
  categoryId: string,
): number {
  return coverages.filter((coverage) => coverage.categoryId === categoryId).length;
}
