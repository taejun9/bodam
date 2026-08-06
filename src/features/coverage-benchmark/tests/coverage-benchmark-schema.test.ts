import { describe, expect, it } from "vitest";

import {
  MAX_COVERAGE_BENCHMARK_WON,
  parseCoverageBenchmark,
  parseCoverageBenchmarkInput,
  parseCoverageBenchmarkWire,
  toCoverageBenchmarkWireInput,
} from "../schemas/coverage-benchmark-schema";
import {
  coverageBenchmarkRangesOverlap,
  sortCoverageBenchmarks,
} from "../services/coverage-benchmark-rules";
import {
  CoverageBenchmarkRepositoryError,
  CoverageBenchmarkValidationError,
  coverageBenchmarkSafeMessage,
} from "../types/coverage-benchmark-error";
import {
  benchmark,
  benchmarkIds,
  benchmarkInput,
  categoryIds,
  timestamp,
} from "./coverage-benchmark-test-data";

describe("CoverageBenchmark schema", () => {
  it("trims gender by Unicode scalar count and keeps every input field required", () => {
    expect(parseCoverageBenchmarkInput(
      benchmarkInput({ gender: `  ${"가".repeat(100)}  ` }),
    ).gender).toBe("가".repeat(100));
    expect(() => parseCoverageBenchmarkInput(
      benchmarkInput({ gender: "가".repeat(101) }),
    )).toThrow(CoverageBenchmarkValidationError);
    expect(parseCoverageBenchmarkInput(
      benchmarkInput({ gender: "🧭".repeat(100) }),
    ).gender).toBe("🧭".repeat(100));
    expect(() => parseCoverageBenchmarkInput(
      benchmarkInput({ gender: "🧭".repeat(101) }),
    )).toThrow(CoverageBenchmarkValidationError);
    expect(() => parseCoverageBenchmarkInput({
      ...benchmarkInput(),
      extra: "synthetic-secret",
    })).toThrow(CoverageBenchmarkValidationError);
    const missingGender = {
      categoryId: categoryIds[0],
      minAgeYears: 20,
      maxAgeYears: 29,
      adequateMinWon: 50n,
      excessiveMinWon: 100n,
    };
    expect(() => parseCoverageBenchmarkInput(missingGender)).toThrow(
      CoverageBenchmarkValidationError,
    );
    expect(parseCoverageBenchmarkInput(
      benchmarkInput({ gender: "\ufeff합성 성별\ufeff" }),
    ).gender).toBe("합성 성별");
    expect(parseCoverageBenchmarkInput(
      benchmarkInput({ gender: "\u0085합성 성별\u0085" }),
    ).gender).toBe("\u0085합성 성별\u0085");
    for (const gender of ["\ud800", "\udc00"]) {
      expect(() => parseCoverageBenchmarkInput(benchmarkInput({ gender }))).toThrow(
        CoverageBenchmarkValidationError,
      );
    }
  });

  it("enforces inclusive age and threshold boundaries", () => {
    expect(parseCoverageBenchmarkInput(benchmarkInput({
      minAgeYears: 0,
      maxAgeYears: 150,
      adequateMinWon: 0n,
      excessiveMinWon: MAX_COVERAGE_BENCHMARK_WON,
    }))).toMatchObject({ minAgeYears: 0, maxAgeYears: 150 });

    for (const invalid of [
      { minAgeYears: -1 },
      { minAgeYears: 1.5 },
      { maxAgeYears: 151 },
      { minAgeYears: 30, maxAgeYears: 29 },
      { adequateMinWon: -1n },
      { excessiveMinWon: MAX_COVERAGE_BENCHMARK_WON + 1n },
      { adequateMinWon: 100n, excessiveMinWon: 100n },
      { adequateMinWon: 101n, excessiveMinWon: 100n },
    ]) {
      expect(() => parseCoverageBenchmarkInput(benchmarkInput(invalid))).toThrow(
        CoverageBenchmarkValidationError,
      );
    }
  });

  it("uses canonical decimal wire values and canonical UTC responses", () => {
    expect(toCoverageBenchmarkWireInput(benchmarkInput())).toMatchObject({
      adequateMinWon: "50",
      excessiveMinWon: "100",
    });
    const wire = {
      id: benchmarkIds[0],
      ...toCoverageBenchmarkWireInput(benchmarkInput()),
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    expect(parseCoverageBenchmarkWire(wire)).toMatchObject({
      adequateMinWon: 50n,
      excessiveMinWon: 100n,
    });
    for (const amount of [" 50", "050", "50.0", "-1", ""]) {
      expect(() => parseCoverageBenchmarkWire({
        ...wire,
        adequateMinWon: amount,
      })).toThrow(CoverageBenchmarkRepositoryError);
    }
    expect(() => parseCoverageBenchmark({
      ...benchmark(benchmarkIds[0]),
      createdAt: "2026-08-06T01:02:03Z",
    })).toThrow(CoverageBenchmarkRepositoryError);
    expect(() => parseCoverageBenchmark({
      ...benchmark(benchmarkIds[0]),
      unknown: true,
    })).toThrow(CoverageBenchmarkRepositoryError);
  });

  it("sorts without locale rules and detects inclusive overlap", () => {
    expect(sortCoverageBenchmarks([
      benchmark(benchmarkIds[2], { categoryId: categoryIds[1] }),
      benchmark(benchmarkIds[1], { minAgeYears: 30, maxAgeYears: 39 }),
      benchmark(benchmarkIds[0], { minAgeYears: 20, maxAgeYears: 29 }),
    ]).map((item) => item.id)).toEqual([
      benchmarkIds[0],
      benchmarkIds[1],
      benchmarkIds[2],
    ]);
    expect(coverageBenchmarkRangesOverlap(
      { minAgeYears: 0, maxAgeYears: 19 },
      { minAgeYears: 19, maxAgeYears: 29 },
    )).toBe(true);
    expect(coverageBenchmarkRangesOverlap(
      { minAgeYears: 0, maxAgeYears: 19 },
      { minAgeYears: 20, maxAgeYears: 29 },
    )).toBe(false);
  });

  it("never echoes unknown values through safe messages", () => {
    expect(coverageBenchmarkSafeMessage(new Error("synthetic-secret"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(coverageBenchmarkSafeMessage(
      new CoverageBenchmarkRepositoryError("기준을 찾을 수 없습니다.", "not_found"),
    )).toBe("기준을 찾을 수 없습니다.");
  });
});
