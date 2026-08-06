import { describe, expect, it } from "vitest";

import { addCalendarDays } from "../services/dashboard-date";
import { buildDashboardReadModel } from "../services/dashboard-read-model";
import type {
  DashboardCustomerFacts,
  DashboardSources,
} from "../types/dashboard";

const referenceDate = "2026-08-06";

function customer(id: string, daysAgo?: number): DashboardCustomerFacts {
  return {
    customerId: id,
    customerName: `합성 고객 ${id}`,
    isManaged: true,
    birthDate: null,
    totalMonthlyPremiumWon: 0n,
    policies: [],
    consultations: daysAgo === undefined ? [] : [{
      consultationId: `${id}-consultation`,
      consultedAt: `${addCalendarDays(referenceDate, -daysAgo)}T01:00:00.000Z`,
      nextContactOn: null,
    }],
    coverageAssessments: [],
  };
}

describe("dashboard configurable settings", () => {
  it("applies exact recent, unconsulted, and card boundaries", () => {
    const sources: DashboardSources = {
      customers: [
        customer("day-6", 6),
        customer("day-7", 7),
        customer("day-39", 39),
        customer("day-40", 40),
        customer("never"),
      ],
      families: [],
    };
    const model = buildDashboardReadModel(sources, {
      referenceDate,
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "Asia/Seoul",
      recentConsultationDays: 7,
      unconsultedDays: 40,
      dashboardItemLimit: 1,
    });

    expect(model.recentConsultation.totalCount).toBe(1);
    expect(model.recentConsultation.items[0]?.customerId).toBe("day-6");
    expect(model.unconsulted.totalCount).toBe(2);
    expect(model.unconsulted.items).toHaveLength(1);
    expect(model.unconsulted.items[0]?.customerId).toBe("never");
    expect(model.unconsulted.isTruncated).toBe(true);
    expect(model.recentConsultationDays).toBe(7);
    expect(model.unconsultedDays).toBe(40);
    expect(model.dashboardItemLimit).toBe(1);
  });
});
