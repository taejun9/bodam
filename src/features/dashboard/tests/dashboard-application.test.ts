import { describe, expect, it, vi } from "vitest";

import type { Consultation } from "@/features/consultation/types/consultation";
import type { CoverageBenchmark } from "@/features/coverage-benchmark/types/coverage-benchmark";
import type { Coverage, CoverageCategory } from "@/features/coverage/types/coverage";
import type { Customer } from "@/features/customer/types/customer";
import type { FamilySummary } from "@/features/family/types/family";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import { DashboardApplication } from "../application/dashboard-application";
import { dashboardSafeMessage } from "../types/dashboard-error";

const timestamp = "2026-08-05T01:00:00.000Z";
const ids = {
  customer: "81000000-0000-4000-8000-000000000001",
  unmanaged: "81000000-0000-4000-8000-000000000002",
  family: "82000000-0000-4000-8000-000000000001",
  policy: "83000000-0000-4000-8000-000000000001",
  category: "84000000-0000-4000-8000-000000000001",
  benchmark: "85000000-0000-4000-8000-000000000001",
  coverage: "86000000-0000-4000-8000-000000000001",
  consultation: "87000000-0000-4000-8000-000000000001",
} as const;

function customer(id: string, isManaged: boolean): Customer {
  return {
    id,
    name: isManaged ? "합성 관리 고객" : "합성 비관리 고객",
    birthDate: "2000-02-20",
    gender: "합성 성별",
    phone: null,
    address: null,
    memo: null,
    status: null,
    isManaged,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const policy: InsurancePolicy = {
  id: ids.policy,
  customerId: ids.customer,
  insurer: "합성 보험사",
  productName: "합성 계약",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon: 120_000n,
  disclosurePlan: null,
  maturesOn: "2026-08-20",
  renewable: false,
  status: null,
  isIncluded: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const category: CoverageCategory = {
  id: ids.category,
  name: "합성 암 보장",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const benchmark: CoverageBenchmark = {
  id: ids.benchmark,
  categoryId: ids.category,
  gender: "합성 성별",
  minAgeYears: 0,
  maxAgeYears: 100,
  adequateMinWon: 12_000_001n,
  excessiveMinWon: 20_000_000n,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const coverage: Coverage = {
  id: ids.coverage,
  policyId: ids.policy,
  categoryId: ids.category,
  amountWon: 12_000_000n,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const consultation: Consultation = {
  id: ids.consultation,
  customerId: ids.customer,
  consultedAt: timestamp,
  content: null,
  nextContactOn: "2026-08-05",
  result: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};

function readers() {
  const customers = {
    list: vi.fn().mockResolvedValue([
      customer(ids.customer, true),
      customer(ids.unmanaged, false),
    ]),
  };
  const insurance = {
    list: vi.fn().mockResolvedValue([policy]),
    total: vi.fn().mockReturnValue(120_000n),
  };
  const families = {
    list: vi.fn().mockResolvedValue([{
      family: {
        id: ids.family,
        name: "합성 가족",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      memberCount: 1,
      totalMonthlyPremiumWon: 120_000n,
    } satisfies FamilySummary]),
  };
  const coverageReader = {
    listCategories: vi.fn().mockResolvedValue([category]),
    list: vi.fn().mockResolvedValue([coverage]),
  };
  const benchmarks = {
    list: vi.fn().mockResolvedValue([benchmark]),
    assessCustomer: vi.fn().mockReturnValue([{
      categoryId: category.id,
      categoryName: category.name,
      amountWon: coverage.amountWon,
      coverageCount: 1,
      status: "insufficient",
      ageYears: 26,
      benchmark,
    }]),
  };
  const consultations = { list: vi.fn().mockResolvedValue([consultation]) };
  return {
    customers,
    insurance,
    families,
    coverage: coverageReader,
    benchmarks,
    consultations,
  };
}

describe("DashboardApplication", () => {
  it("composes public feature results for managed customers only", async () => {
    const source = readers();
    const application = new DashboardApplication(
      source.customers,
      source.insurance,
      source.families,
      source.coverage,
      source.benchmarks,
      source.consultations,
    );

    const result = await application.load({
      referenceDate: "2026-08-06",
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "Asia/Seoul",
    });

    expect(result.referenceDate).toBe("2026-08-06");
    expect(result.todayContact.items[0]?.customerId).toBe(ids.customer);
    expect(result.maturity.items[0]?.policyId).toBe(ids.policy);
    expect(result.premiumTop.items[0]?.amountWon).toBe(120_000n);
    expect(result.familyPremium.items[0]?.familyId).toBe(ids.family);
    expect(result.coverageInsufficient.items[0]?.categories[0]?.categoryId)
      .toBe(ids.category);
    expect(source.insurance.list).toHaveBeenCalledTimes(1);
    expect(source.insurance.list).toHaveBeenCalledWith(ids.customer);
    expect(source.coverage.list).not.toHaveBeenCalledWith(ids.unmanaged);
    expect(source.consultations.list).not.toHaveBeenCalledWith(ids.unmanaged);
    expect(source.benchmarks.assessCustomer).toHaveBeenCalledWith(
      expect.objectContaining({ id: ids.customer }),
      [category],
      [policy],
      [coverage],
      [benchmark],
      "2026-08-06",
    );
  });

  it("uses ten as the display limit when none is provided", async () => {
    const source = readers();
    source.families.list.mockResolvedValue(Array.from({ length: 11 }, (_, index) => ({
      family: {
        id: `82000000-0000-4000-8000-${(index + 1).toString().padStart(12, "0")}`,
        name: `합성 가족 ${index}`,
        createdAt: timestamp,
        updatedAt: timestamp,
      },
      memberCount: 1,
      totalMonthlyPremiumWon: BigInt(11 - index),
    })));
    const application = new DashboardApplication(
      source.customers,
      source.insurance,
      source.families,
      source.coverage,
      source.benchmarks,
      source.consultations,
    );

    const result = await application.load({
      referenceDate: "2026-08-06",
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "Asia/Seoul",
    });

    expect(result.familyPremium.totalCount).toBe(11);
    expect(result.familyPremium.items).toHaveLength(10);
    expect(result.familyPremium.isTruncated).toBe(true);
  });

  it("replaces adapter details with a privacy-safe error", async () => {
    const source = readers();
    source.coverage.listCategories.mockRejectedValue(
      new Error("private-row-marker-dashboard-008"),
    );
    const application = new DashboardApplication(
      source.customers,
      source.insurance,
      source.families,
      source.coverage,
      source.benchmarks,
      source.consultations,
    );

    let caught: unknown;
    try {
      await application.load({
        referenceDate: "2026-08-06",
        referenceInstant: "2026-08-06T03:00:00.000Z",
        timeZone: "Asia/Seoul",
      });
    } catch (error) {
      caught = error;
    }
    expect(dashboardSafeMessage(caught)).toBe(
      "대시보드를 불러오지 못했습니다. 다시 시도해 주세요.",
    );
    expect(String(caught)).not.toContain("private-row-marker-dashboard-008");
  });

  it("validates the query before reading feature sources", async () => {
    const source = readers();
    const application = new DashboardApplication(
      source.customers,
      source.insurance,
      source.families,
      source.coverage,
      source.benchmarks,
      source.consultations,
    );

    await expect(application.load({
      referenceDate: "2026-02-30",
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "not/a-zone",
    })).rejects.toThrow("대시보드를 불러오지 못했습니다");
    expect(source.customers.list).not.toHaveBeenCalled();
    expect(source.families.list).not.toHaveBeenCalled();
  });
});
