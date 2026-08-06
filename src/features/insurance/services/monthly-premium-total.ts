import type { InsurancePolicy } from "../types/insurance-policy";

export function calculateIncludedMonthlyPremiumTotal(
  policies: readonly InsurancePolicy[],
): bigint {
  return policies.reduce(
    (total, policy) =>
      policy.isIncluded ? total + policy.monthlyPremiumWon : total,
    0n,
  );
}
