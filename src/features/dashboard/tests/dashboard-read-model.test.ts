import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../services/dashboard-date";
import { buildDashboardReadModel } from "../services/dashboard-read-model";
import type {
  DashboardConsultationFact,
  DashboardCoverageAssessmentFact,
  DashboardCustomerFacts,
  DashboardFamilyFacts,
  DashboardPolicyFact,
  DashboardSources,
} from "../types/dashboard";

const query = {
  referenceDate: "2026-08-06",
  referenceInstant: "2026-08-06T03:00:00.000Z",
  timeZone: "Asia/Seoul",
  recentConsultationDays: 30,
  unconsultedDays: 90,
  dashboardItemLimit: 10,
} as const;

function customer(
  customerId: string,
  overrides: Partial<DashboardCustomerFacts> = {},
): DashboardCustomerFacts {
  return {
    customerId,
    customerName: `합성 고객 ${customerId}`,
    isManaged: true,
    birthDate: null,
    totalMonthlyPremiumWon: 0n,
    policies: [],
    consultations: [],
    coverageAssessments: [],
    ...overrides,
  };
}

function policy(
  policyId: string,
  maturesOn: string | null,
  isIncluded = true,
): DashboardPolicyFact {
  return {
    policyId,
    insurer: "합성 보험사",
    productName: "합성 계약",
    maturesOn,
    isIncluded,
  };
}

function consultation(
  consultationId: string,
  localOn: string,
  nextContactOn: string | null = null,
): DashboardConsultationFact {
  return {
    consultationId,
    consultedAt: `${localOn}T01:00:00.000Z`,
    nextContactOn,
  };
}

function assessment(
  categoryId: string,
  categoryName: string,
  status: DashboardCoverageAssessmentFact["status"],
  amountWon: bigint,
  adequateMinWon: bigint | null,
): DashboardCoverageAssessmentFact {
  return { categoryId, categoryName, status, amountWon, adequateMinWon };
}

const sources = (
  customers: readonly DashboardCustomerFacts[],
  families: readonly DashboardFamilyFacts[] = [],
): DashboardSources => ({ customers, families });

describe("dashboard read model date cards", () => {
  it("keeps exact 0/30/31/60/61/90 boundaries and excludes past/91", () => {
    const ageCases = [
      ["age-0", "2000-02-06"],
      ["age-30", "2000-03-05"],
      ["age-31", "2000-03-06"],
      ["age-60", "2000-04-05"],
      ["age-61", "2000-04-06"],
      ["age-90", "2000-05-04"],
      ["age-91", "2000-05-05"],
    ] as const;
    const maturityDates = [
      ["m-0", "2026-08-06", true],
      ["m-30", "2026-09-05", false],
      ["m-31", "2026-09-06", true],
      ["m-60", "2026-10-05", true],
      ["m-61", "2026-10-06", true],
      ["m-90", "2026-11-04", true],
      ["m-91", "2026-11-05", true],
      ["m-past", "2026-08-05", true],
    ] as const;
    const model = buildDashboardReadModel(sources([
      ...ageCases.map(([id, birthDate]) => customer(id, { birthDate })),
      customer("maturity", {
        policies: maturityDates.map(([id, date, included]) =>
          policy(id, date, included)
        ),
      }),
    ]), query);

    expect(model.insuranceAge.items.map(({ daysUntil, bucket }) =>
      [daysUntil, bucket])).toEqual([
      [0, "0-30"], [30, "0-30"], [31, "31-60"],
      [60, "31-60"], [61, "61-90"], [90, "61-90"],
    ]);
    expect(model.maturity.items.map(({ daysUntil, bucket }) =>
      [daysUntil, bucket])).toEqual([
      [0, "0-30"], [30, "0-30"], [31, "31-60"],
      [60, "31-60"], [61, "61-90"], [90, "61-90"],
    ]);
    expect(model.maturity.items[1]?.policyId).toBe("m-30");
    expect(model.maturity.totalCount).toBe(6);
  });

  it("uses only the latest eligible consultation for today's contact", () => {
    const model = buildDashboardReadModel(sources([
      customer("superseded", { consultations: [
        consultation("old", "2026-08-01", "2026-08-01"),
        consultation("new", "2026-08-05", null),
      ] }),
      customer("overdue", { consultations: [
        consultation("overdue-now", "2026-08-05", "2026-08-04"),
      ] }),
      customer("today", { consultations: [
        consultation("today-now", "2026-08-06", "2026-08-06"),
      ] }),
      customer("future", { consultations: [
        consultation("past-eligible", "2026-08-02", "2026-08-02"),
        consultation("future-ignored", "2026-08-07", null),
      ] }),
      customer("tie", { consultations: [
        consultation("a-tie", "2026-08-05", "2026-08-03"),
        consultation("b-tie", "2026-08-05", null),
      ] }),
    ]), query);

    expect(model.todayContact.items.map(({ customerId }) => customerId)).toEqual([
      "future", "tie", "overdue", "today",
    ]);
    expect(model.todayContact.items[0]?.consultationId).toBe("past-eligible");
    expect(model.todayContact.items[1]?.consultationId).toBe("a-tie");
    expect(model.todayContact.items[2]?.daysOverdue).toBe(2);
    expect(model.todayContact.items[3]?.reason).toBe("오늘 연락 예정");
  });

  it("includes exact recent-30 and unconsulted-90 rules with never first", () => {
    const dated = (id: string, daysAgo: number) => customer(id, {
      consultations: [consultation(
        `${id}-consultation`,
        addCalendarDays(query.referenceDate, -daysAgo),
      )],
    });
    const model = buildDashboardReadModel(sources([
      dated("today", 0),
      dated("day-29", 29),
      dated("day-30", 30),
      dated("day-89", 89),
      dated("day-90", 90),
      customer("never-a", { customerName: "합성 미상담 A" }),
      customer("never-b", {
        customerName: "합성 미상담 B",
        consultations: [consultation("future-only", "2026-08-07")],
      }),
    ]), query);

    expect(model.recentConsultation.items.map(({ customerId, daysAgo }) =>
      [customerId, daysAgo])).toEqual([["today", 0], ["day-29", 29]]);
    expect(model.unconsulted.items.map(({ customerId }) => customerId)).toEqual([
      "never-a", "never-b", "day-90",
    ]);
    expect(model.unconsulted.items[0]?.daysSince).toBeNull();
    expect(model.unconsulted.items[2]?.daysSince).toBe(90);
  });

  it("ignores consultations later than the reference instant on the same local date", () => {
    const model = buildDashboardReadModel(sources([
      customer("same-day-future", { consultations: [
        consultation("older", "2026-08-05", "2026-08-05"),
        {
          consultationId: "later-today",
          consultedAt: "2026-08-06T03:00:00.001Z",
          nextContactOn: null,
        },
      ] }),
      customer("future-only", { consultations: [{
        consultationId: "future-only-consultation",
        consultedAt: "2026-08-06T03:00:00.001Z",
        nextContactOn: null,
      }] }),
    ]), query);

    expect(model.todayContact.items[0]?.consultationId).toBe("older");
    expect(model.recentConsultation.items[0]?.consultationId).toBe("older");
    expect(model.unconsulted.items[0]?.customerId).toBe("future-only");
  });
});

describe("dashboard read model ranking cards", () => {
  it("preserves bigint, excludes zero, and groups only insufficient coverage", () => {
    const maximum = 9_223_372_036_854_775_807n;
    const coverage = [
      assessment("cat-b", "합성 보장 B", "insufficient", 1n, 5n),
      assessment("cat-a", "합성 보장 A", "insufficient", 0n, 100n),
      assessment("cat-c", "합성 보장 C", "adequate", 5n, 5n),
      assessment("cat-d", "합성 보장 D", "unconfigured", 0n, null),
      assessment("cat-e", "합성 보장 E", "excessive", 10n, 5n),
    ];
    const model = buildDashboardReadModel(sources([
      customer("premium-b", {
        customerName: "합성 동명",
        totalMonthlyPremiumWon: maximum,
        coverageAssessments: coverage,
      }),
      customer("premium-a", {
        customerName: "합성 동명",
        totalMonthlyPremiumWon: maximum,
        coverageAssessments: [
          assessment("zero-coverage", "합성 무보장", "insufficient", 0n, 1n),
        ],
      }),
      customer("zero", { totalMonthlyPremiumWon: 0n }),
    ], [
      { familyId: "family-b", familyName: "합성 동명", memberCount: 2,
        totalMonthlyPremiumWon: maximum },
      { familyId: "family-a", familyName: "합성 동명", memberCount: 1,
        totalMonthlyPremiumWon: maximum },
      { familyId: "family-zero", familyName: "합성 0원", memberCount: 1,
        totalMonthlyPremiumWon: 0n },
    ]), query);

    expect(model.premiumTop.items.map(({ customerId }) => customerId))
      .toEqual(["premium-a", "premium-b"]);
    expect(model.premiumTop.items[0]?.amountWon).toBe(maximum);
    expect(model.familyPremium.items.map(({ familyId }) => familyId))
      .toEqual(["family-a", "family-b"]);
    expect(model.coverageInsufficient.items.map(({ customerId }) => customerId))
      .toEqual(["premium-b", "premium-a"]);
    expect(model.coverageInsufficient.items[0]?.categories.map(
      ({ categoryId }) => categoryId,
    )).toEqual(["cat-a", "cat-b"]);
    expect(model.coverageInsufficient.items[0]?.categories[0]?.shortfallWon)
      .toBe(100n);
    expect(model.coverageInsufficient.items[1]?.categories[0]?.amountWon).toBe(0n);
  });

  it("filters unmanaged customer facts at the read-model boundary", () => {
    const model = buildDashboardReadModel(sources([
      customer("managed", { totalMonthlyPremiumWon: 1n }),
      customer("unmanaged", { isManaged: false, totalMonthlyPremiumWon: 2n }),
    ]), query);

    expect(model.premiumTop.items.map(({ customerId }) => customerId))
      .toEqual(["managed"]);
  });

  it("reports total count before a stable ten-item limit without mutating input", () => {
    const customers = Array.from({ length: 11 }, (_, index) => customer(
      `customer-${index.toString().padStart(2, "0")}`,
      { customerName: "합성 동명", totalMonthlyPremiumWon: 1n },
    ));
    const before = customers.map(({ customerId }) => customerId);
    const model = buildDashboardReadModel(sources(customers), query);

    expect(model.premiumTop.totalCount).toBe(11);
    expect(model.premiumTop.items).toHaveLength(10);
    expect(model.premiumTop.isTruncated).toBe(true);
    expect(model.premiumTop.items[0]?.customerId).toBe("customer-00");
    expect(customers.map(({ customerId }) => customerId)).toEqual(before);
  });

  it("rejects inconsistent source facts instead of silently classifying them", () => {
    const malformed = customer("malformed", {
      coverageAssessments: [
        assessment("bad", "합성 오류", "insufficient", 10n, 10n),
      ],
    });
    expect(() => buildDashboardReadModel(sources([malformed]), query))
      .toThrow("부족 판정");
  });
});
