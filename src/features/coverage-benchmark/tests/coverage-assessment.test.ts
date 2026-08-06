import { describe, expect, it } from "vitest";

import { parseCustomerCreateInput } from "@/features/customer/schemas/customer-schema";

import { CoverageBenchmarkApplication } from "../application/coverage-benchmark-application";
import type { CoverageBenchmarkRepository } from "../repositories/coverage-benchmark-repository";
import {
  assessCustomerCoverage,
  classifyCoverageAmount,
} from "../services/coverage-assessment";
import { calculateFullAge } from "../services/customer-full-age";
import { CoverageBenchmarkValidationError } from "../types/coverage-benchmark-error";
import {
  benchmark,
  benchmarkIds,
  categories,
  categoryIds,
  coverage,
  customer,
  policy,
  policyIds,
} from "./coverage-benchmark-test-data";

const unusedRepository: CoverageBenchmarkRepository = {
  list: () => Promise.resolve([]),
  create: () => Promise.reject(new Error("unused")),
  update: () => Promise.reject(new Error("unused")),
  remove: () => Promise.reject(new Error("unused")),
};

const application = new CoverageBenchmarkApplication(unusedRepository);

describe("full age", () => {
  it("changes on the birthday using an explicit date-only reference", () => {
    expect(calculateFullAge("2000-08-06", "2026-08-05")).toBe(25);
    expect(calculateFullAge("2000-08-06", "2026-08-06")).toBe(26);
    expect(calculateFullAge("2000-08-06", "2026-08-07")).toBe(26);
  });

  it("clamps February 29 to February 28 in a non-leap year", () => {
    expect(calculateFullAge("2000-02-29", "2025-02-27")).toBe(24);
    expect(calculateFullAge("2000-02-29", "2025-02-28")).toBe(25);
    expect(calculateFullAge("2000-02-29", "2024-02-28")).toBe(23);
    expect(calculateFullAge("2000-02-29", "2024-02-29")).toBe(24);
  });

  it("returns null for missing or future birth dates and validates reference dates", () => {
    expect(calculateFullAge(null, "2026-08-06")).toBeNull();
    expect(calculateFullAge("2026-08-07", "2026-08-06")).toBeNull();
    expect(() => calculateFullAge("2000-01-01", "2026-02-30")).toThrow(
      CoverageBenchmarkValidationError,
    );
  });
});

describe("coverage assessment", () => {
  it("uses exact bigint thresholds", () => {
    const thresholds = { adequateMinWon: 50n, excessiveMinWon: 100n };
    expect(classifyCoverageAmount(49n, thresholds)).toBe("insufficient");
    expect(classifyCoverageAmount(50n, thresholds)).toBe("adequate");
    expect(classifyCoverageAmount(99n, thresholds)).toBe("adequate");
    expect(classifyCoverageAmount(100n, thresholds)).toBe("excessive");
  });

  it("unions included coverage categories with matched zero-coverage benchmarks", () => {
    const assessments = application.assessCustomer(
      customer,
      categories,
      [policy(policyIds[0], true), policy(policyIds[1], false)],
      [
        coverage(benchmarkIds[0], policyIds[0], categoryIds[0], 49n),
        coverage(benchmarkIds[1], policyIds[0], categoryIds[1], 5n),
        coverage(benchmarkIds[2], policyIds[1], categoryIds[0], 999n),
      ],
      [
        benchmark(benchmarkIds[3], { categoryId: categoryIds[0] }),
        benchmark(benchmarkIds[4], { categoryId: categoryIds[2] }),
      ],
      "2026-08-06",
    );

    expect(assessments).toMatchObject([
      {
        categoryId: categoryIds[0],
        amountWon: 49n,
        coverageCount: 1,
        status: "insufficient",
        ageYears: 26,
      },
      {
        categoryId: categoryIds[1],
        amountWon: 5n,
        coverageCount: 1,
        status: "unconfigured",
        benchmark: null,
      },
      {
        categoryId: categoryIds[2],
        amountWon: 0n,
        coverageCount: 0,
        status: "insufficient",
      },
    ]);
  });

  it("requires exact gender and an available non-future birth date", () => {
    const coverages = [
      coverage(benchmarkIds[0], policyIds[0], categoryIds[0], 999n),
    ];
    const benchmarks = [benchmark(benchmarkIds[1])];
    for (const changedCustomer of [
      { ...customer, gender: "합성 성별 " },
      { ...customer, gender: "다른 성별" },
      { ...customer, gender: null },
      { ...customer, birthDate: null },
      { ...customer, birthDate: "2026-08-07" },
    ]) {
      const result = assessCustomerCoverage(
        changedCustomer,
        categories,
        [policy(policyIds[0], true)],
        coverages,
        benchmarks,
        "2026-08-06",
      );
      expect(result).toMatchObject([{ status: "unconfigured", benchmark: null }]);
    }
  });

  it("keeps Customer and Benchmark ECMAScript gender normalization aligned", () => {
    const customerInput = parseCustomerCreateInput({
      name: "합성 고객",
      birthDate: "2000-08-06",
      gender: "\ufeff합성 성별\ufeff",
      phone: null,
      address: null,
      memo: null,
      status: null,
      isManaged: true,
    });
    const normalizedBenchmark = benchmark(benchmarkIds[0], {
      gender: "합성 성별",
    });
    expect(assessCustomerCoverage(
      { ...customer, gender: customerInput.gender },
      categories,
      [],
      [],
      [normalizedBenchmark],
      "2026-08-06",
    )).toMatchObject([{ status: "insufficient", benchmark: normalizedBenchmark }]);

    for (const gender of ["\ud800", "\udc00"]) {
      expect(() => parseCustomerCreateInput({ ...customerInput, gender })).toThrow();
    }
  });

  it("fails safely instead of choosing among multiple matching rows", () => {
    const run = () => assessCustomerCoverage(
      customer,
      categories,
      [],
      [],
      [
        benchmark(benchmarkIds[0], { minAgeYears: 20, maxAgeYears: 29 }),
        benchmark(benchmarkIds[1], { minAgeYears: 26, maxAgeYears: 35 }),
      ],
      "2026-08-06",
    );
    expect(run).toThrow(expect.objectContaining({
      code: "storage_corrupt",
      message: "보장 비교 기준이 중복되어 판정할 수 없습니다.",
    }));
    expect(run).not.toThrow(/20|29|26|35/);
  });

  it("counts category bindings by stable ID", () => {
    expect(application.categoryBenchmarkUsageCount([
      benchmark(benchmarkIds[0]),
      benchmark(benchmarkIds[1]),
      benchmark(benchmarkIds[2], { categoryId: categoryIds[1] }),
    ], categoryIds[0])).toBe(2);
  });
});
