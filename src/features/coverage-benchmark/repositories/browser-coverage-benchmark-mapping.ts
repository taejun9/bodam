import {
  StoredCoverageBenchmarkWireSchema,
  parseCoverageBenchmarkWire,
} from "../schemas/coverage-benchmark-schema";
import type { CoverageBenchmark } from "../types/coverage-benchmark";
import { CoverageBenchmarkRepositoryError } from "../types/coverage-benchmark-error";
import type { StoredCoverageBenchmarkWire } from "./browser-coverage-benchmark-storage";

export function parseStoredCoverageBenchmark(
  value: unknown,
): StoredCoverageBenchmarkWire {
  const parsed = StoredCoverageBenchmarkWireSchema.safeParse(value);
  if (!parsed.success) {
    throw new CoverageBenchmarkRepositoryError(
      "보장 비교 기준 데이터를 저장할 수 없습니다.",
    );
  }
  return parsed.data;
}

export function coverageBenchmarkFromStored(
  benchmark: StoredCoverageBenchmarkWire,
): CoverageBenchmark {
  return parseCoverageBenchmarkWire({
    id: benchmark.id,
    categoryId: benchmark.categoryId,
    gender: benchmark.gender,
    minAgeYears: benchmark.minAgeYears,
    maxAgeYears: benchmark.maxAgeYears,
    adequateMinWon: benchmark.adequateMinWon,
    excessiveMinWon: benchmark.excessiveMinWon,
    createdAt: benchmark.createdAt,
    updatedAt: benchmark.updatedAt,
  });
}
