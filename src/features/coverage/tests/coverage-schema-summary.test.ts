import { describe, expect, it } from "vitest";

import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import { CoverageApplication } from "../application/coverage-application";
import { coverageInputFromForm } from "../components/coverage-form";
import type { CoverageRepository } from "../repositories/coverage-repository";
import {
  MAX_COVERAGE_AMOUNT_WON,
  parseCoverageCategoryInput,
  parseCoverageInput,
  parseCoverageWire,
  toCoverageWireInput,
} from "../schemas/coverage-schema";
import type { Coverage, CoverageCategory } from "../types/coverage";
import {
  CoverageRepositoryError,
  CoverageValidationError,
  coverageSafeMessage,
} from "../types/coverage-error";

const customerId = "11111111-1111-4111-8111-111111111111";
const categoryIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
] as const;
const policyIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
] as const;
const coverageIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
  "30000000-0000-4000-8000-000000000004",
] as const;
const timestamp = "2026-08-06T01:02:03.000Z";

const unusedRepository: CoverageRepository = {
  listCategories: () => Promise.resolve([]),
  updateCategory: () => Promise.reject(new Error("unused")),
  removeCategory: () => Promise.reject(new Error("unused")),
  list: () => Promise.resolve([]),
  create: () => Promise.reject(new Error("unused")),
  update: () => Promise.reject(new Error("unused")),
  remove: () => Promise.reject(new Error("unused")),
};

const application = new CoverageApplication(unusedRepository);

const category = (id: string, name: string): CoverageCategory => ({
  id,
  name,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const policy = (id: string, isIncluded: boolean): InsurancePolicy => ({
  id,
  customerId,
  insurer: "합성보험사",
  productName: "합성상품",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon: 10_000n,
  disclosurePlan: null,
  maturesOn: null,
  renewable: false,
  status: null,
  isIncluded,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const coverage = (
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

describe("coverage schemas and safe errors", () => {
  it("rejects surrounding whitespace in form money before bigint conversion", () => {
    for (const amountWon of [" 1", "1 ", " 1 ", "\t1", "1\n"]) {
      const errors = {};
      expect(coverageInputFromForm({ categoryId: categoryIds[0], amountWon }, errors))
        .toBeUndefined();
      expect(errors).toEqual({
        amountWon: "보장금액은 0 이상의 원 단위 정수로 입력해 주세요.",
      });
    }
    expect(coverageInputFromForm(
      { categoryId: categoryIds[0], amountWon: "1" },
      {},
    )).toEqual({ categoryId: categoryIds[0], amountWon: 1n });
  });

  it("trims category names, counts Unicode code points, and rejects loose input", () => {
    expect(parseCoverageCategoryInput({ name: "  암  " })).toEqual({ name: "암" });
    expect(parseCoverageCategoryInput({ name: "가".repeat(100) }).name).toHaveLength(100);
    expect(() => parseCoverageCategoryInput({ name: "가".repeat(101) })).toThrow(
      CoverageValidationError,
    );
    expect(() => parseCoverageCategoryInput({ name: "   " })).toThrow(
      CoverageValidationError,
    );
    expect(() => parseCoverageCategoryInput({ name: "암", extra: true })).toThrow(
      CoverageValidationError,
    );
  });

  it("accepts only bigint amounts in the SQLite i64 range", () => {
    expect(parseCoverageInput({ categoryId: categoryIds[0], amountWon: 0n })).toEqual({
      categoryId: categoryIds[0],
      amountWon: 0n,
    });
    expect(
      toCoverageWireInput({
        categoryId: categoryIds[0],
        amountWon: MAX_COVERAGE_AMOUNT_WON,
      }),
    ).toEqual({
      categoryId: categoryIds[0],
      amountWon: "9223372036854775807",
    });

    for (const amountWon of [
      -1n,
      MAX_COVERAGE_AMOUNT_WON + 1n,
      1.5,
      "1",
    ]) {
      expect(() => parseCoverageInput({ categoryId: categoryIds[0], amountWon })).toThrow(
        CoverageValidationError,
      );
    }
    expect(() => parseCoverageInput({ categoryId: "not-a-uuid", amountWon: 1n })).toThrow(
      CoverageValidationError,
    );
    expect(() => parseCoverageInput({ categoryId: categoryIds[0] })).toThrow(
      CoverageValidationError,
    );
  });

  it("requires canonical decimal strings on the wire and redacts unknown errors", () => {
    const wire = {
      id: coverageIds[0],
      policyId: policyIds[0],
      categoryId: categoryIds[0],
      amountWon: "0",
      createdAt: timestamp,
      updatedAt: timestamp,
    };
    expect(parseCoverageWire(wire).amountWon).toBe(0n);
    for (const amountWon of [" 1", "1 ", "01", "-1", "1.5", ""]) {
      expect(() => parseCoverageWire({ ...wire, amountWon })).toThrow(
        CoverageRepositoryError,
      );
    }
    expect(
      coverageSafeMessage(
        new CoverageValidationError([{ field: "name", message: "확인" }]),
      ),
    ).toBe("입력 내용을 확인해 주세요.");
    expect(
      coverageSafeMessage(
        new CoverageRepositoryError("보장을 찾을 수 없습니다.", "not_found"),
      ),
    ).toBe("보장을 찾을 수 없습니다.");
    expect(coverageSafeMessage(new Error("synthetic private detail"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});

describe("coverage summary", () => {
  it("groups by category ID, ignores excluded policies, and sums beyond i64", () => {
    const categories = [
      category(categoryIds[0], "중복 이름"),
      category(categoryIds[1], "중복 이름"),
      category(categoryIds[2], "기여 없음"),
    ];
    const policies = [
      policy(policyIds[0], true),
      policy(policyIds[1], true),
      policy(policyIds[2], false),
    ];
    const coverages = [
      coverage(coverageIds[0], policyIds[0], categoryIds[0], MAX_COVERAGE_AMOUNT_WON),
      coverage(coverageIds[1], policyIds[1], categoryIds[0], MAX_COVERAGE_AMOUNT_WON),
      coverage(coverageIds[2], policyIds[1], categoryIds[1], 5n),
      coverage(coverageIds[3], policyIds[2], categoryIds[0], 999n),
    ];

    expect(application.summary(categories, policies, coverages)).toEqual([
      {
        categoryId: categoryIds[0],
        categoryName: "중복 이름",
        amountWon: MAX_COVERAGE_AMOUNT_WON * 2n,
        coverageCount: 2,
      },
      {
        categoryId: categoryIds[1],
        categoryName: "중복 이름",
        amountWon: 5n,
        coverageCount: 1,
      },
    ]);
    expect(application.forPolicy(coverages, policyIds[2])).toEqual([coverages[3]]);
    expect(application.categoryUsageCount(coverages, categoryIds[0])).toBe(3);
  });
});
