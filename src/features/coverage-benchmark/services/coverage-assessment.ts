import { calculateCoverageSummary } from "@/features/coverage/services/coverage-summary";
import type {
  Coverage,
  CoverageCategory,
  CoverageSummary,
} from "@/features/coverage/types/coverage";
import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type {
  CoverageAssessment,
  CoverageAssessmentStatus,
  CoverageBenchmark,
} from "../types/coverage-benchmark";
import { CoverageBenchmarkRepositoryError } from "../types/coverage-benchmark-error";
import { calculateFullAge } from "./customer-full-age";

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export function classifyCoverageAmount(
  amountWon: bigint,
  benchmark: Pick<
    CoverageBenchmark,
    "adequateMinWon" | "excessiveMinWon"
  >,
): Exclude<CoverageAssessmentStatus, "unconfigured"> {
  if (amountWon < benchmark.adequateMinWon) return "insufficient";
  if (amountWon < benchmark.excessiveMinWon) return "adequate";
  return "excessive";
}

function matchingBenchmarks(
  benchmarks: readonly CoverageBenchmark[],
  categoryIds: ReadonlySet<string>,
  gender: string | null,
  ageYears: number | null,
): Map<string, CoverageBenchmark> {
  const matches = new Map<string, CoverageBenchmark>();
  if (gender === null || ageYears === null) return matches;

  for (const benchmark of benchmarks) {
    if (
      !categoryIds.has(benchmark.categoryId) ||
      benchmark.gender !== gender ||
      ageYears < benchmark.minAgeYears ||
      ageYears > benchmark.maxAgeYears
    ) continue;
    if (matches.has(benchmark.categoryId)) {
      throw new CoverageBenchmarkRepositoryError(
        "보장 비교 기준이 중복되어 판정할 수 없습니다.",
        "storage_corrupt",
      );
    }
    matches.set(benchmark.categoryId, benchmark);
  }
  return matches;
}

function assessmentFrom(
  category: CoverageCategory,
  summary: CoverageSummary | undefined,
  benchmark: CoverageBenchmark | undefined,
  ageYears: number | null,
): CoverageAssessment {
  const amountWon = summary?.amountWon ?? 0n;
  return {
    categoryId: category.id,
    categoryName: category.name,
    amountWon,
    coverageCount: summary?.coverageCount ?? 0,
    status: benchmark === undefined
      ? "unconfigured"
      : classifyCoverageAmount(amountWon, benchmark),
    ageYears,
    benchmark: benchmark ?? null,
  };
}

export function assessCustomerCoverage(
  customer: Customer,
  categories: readonly CoverageCategory[],
  policies: readonly InsurancePolicy[],
  coverages: readonly Coverage[],
  benchmarks: readonly CoverageBenchmark[],
  referenceDate: string,
): CoverageAssessment[] {
  const ageYears = calculateFullAge(customer.birthDate, referenceDate);
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const summaryByCategory = new Map(
    calculateCoverageSummary(categories, policies, coverages)
      .map((summary) => [summary.categoryId, summary]),
  );
  const matchedByCategory = matchingBenchmarks(
    benchmarks,
    new Set(categoryById.keys()),
    customer.gender,
    ageYears,
  );
  const includedIds = new Set([
    ...summaryByCategory.keys(),
    ...matchedByCategory.keys(),
  ]);

  return [...includedIds]
    .sort(compareText)
    .flatMap((categoryId) => {
      const category = categoryById.get(categoryId);
      return category === undefined
        ? []
        : [assessmentFrom(
            category,
            summaryByCategory.get(categoryId),
            matchedByCategory.get(categoryId),
            ageYears,
          )];
    });
}
