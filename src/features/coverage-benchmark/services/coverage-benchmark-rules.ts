import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export function sortCoverageBenchmarks(
  benchmarks: readonly CoverageBenchmark[],
): CoverageBenchmark[] {
  return [...benchmarks].sort((left, right) =>
    compareText(left.categoryId, right.categoryId) ||
    left.minAgeYears - right.minAgeYears ||
    left.maxAgeYears - right.maxAgeYears ||
    compareText(left.id, right.id)
  );
}

export function coverageBenchmarkRangesOverlap(
  left: Pick<CoverageBenchmarkInput, "minAgeYears" | "maxAgeYears">,
  right: Pick<CoverageBenchmarkInput, "minAgeYears" | "maxAgeYears">,
): boolean {
  return left.minAgeYears <= right.maxAgeYears &&
    right.minAgeYears <= left.maxAgeYears;
}

export function categoryBenchmarkUsageCount(
  benchmarks: readonly CoverageBenchmark[],
  categoryId: string,
): number {
  return benchmarks.filter((benchmark) => benchmark.categoryId === categoryId).length;
}
