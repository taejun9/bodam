import type {
  CoverageInsufficientItem,
  DashboardCustomerFacts,
  DashboardFamilyFacts,
  FamilyPremiumItem,
  InsufficientCoverageCategoryItem,
  PremiumTopItem,
} from "../types/dashboard";

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

const compareAmountDescending = (left: bigint, right: bigint): number => {
  if (left > right) return -1;
  if (left < right) return 1;
  return 0;
};

export function buildPremiumTopItems(
  customers: readonly DashboardCustomerFacts[],
): PremiumTopItem[] {
  return customers.flatMap((customer) =>
    customer.totalMonthlyPremiumWon > 0n
      ? [{
          customerId: customer.customerId,
          customerName: customer.customerName,
          amountWon: customer.totalMonthlyPremiumWon,
          reason: "합계대상 월보험료",
        }]
      : []
  ).sort((left, right) =>
    compareAmountDescending(left.amountWon, right.amountWon) ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.customerId, right.customerId)
  );
}

export function buildFamilyPremiumItems(
  families: readonly DashboardFamilyFacts[],
): FamilyPremiumItem[] {
  return families.flatMap((family) =>
    family.totalMonthlyPremiumWon > 0n
      ? [{
          familyId: family.familyId,
          familyName: family.familyName,
          memberCount: family.memberCount,
          amountWon: family.totalMonthlyPremiumWon,
          reason: "가족 구성원 합계대상 월보험료",
        }]
      : []
  ).sort((left, right) =>
    compareAmountDescending(left.amountWon, right.amountWon) ||
    compareText(left.familyName, right.familyName) ||
    compareText(left.familyId, right.familyId)
  );
}

function insufficientCategories(
  customer: DashboardCustomerFacts,
): InsufficientCoverageCategoryItem[] {
  return customer.coverageAssessments.flatMap((assessment) => {
    if (assessment.status !== "insufficient" || assessment.adequateMinWon === null) {
      return [];
    }
    return [{
      categoryId: assessment.categoryId,
      categoryName: assessment.categoryName,
      amountWon: assessment.amountWon,
      adequateMinWon: assessment.adequateMinWon,
      shortfallWon: assessment.adequateMinWon - assessment.amountWon,
    }];
  }).sort((left, right) =>
    compareText(left.categoryName, right.categoryName) ||
    compareText(left.categoryId, right.categoryId)
  );
}

export function buildCoverageInsufficientItems(
  customers: readonly DashboardCustomerFacts[],
): CoverageInsufficientItem[] {
  return customers.flatMap((customer) => {
    const categories = insufficientCategories(customer);
    return categories.length === 0
      ? []
      : [{
          customerId: customer.customerId,
          customerName: customer.customerName,
          insufficientCategoryCount: categories.length,
          categories,
          reason: `사용자 설정 기준 미달 ${categories.length}개`,
        }];
  }).sort((left, right) =>
    right.insufficientCategoryCount - left.insufficientCategoryCount ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.customerId, right.customerId)
  );
}
