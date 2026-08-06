import { describe, expect, it, vi } from "vitest";

import type { Consultation } from "@/features/consultation/types/consultation";
import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import { CalendarApplication } from "../application/calendar-application";
import {
  CalendarApplicationError,
  calendarSafeMessage,
} from "../types/calendar-error";
import type { CalendarScheduleDetail } from "../types/calendar";

const timestamp = "2026-08-01T00:00:00.000Z";
const ids = {
  managed: "95000000-0000-4000-8000-000000000001",
  unmanaged: "95000000-0000-4000-8000-000000000002",
  policy: "96000000-0000-4000-8000-000000000001",
  consultation: "97000000-0000-4000-8000-000000000001",
  schedule: "98000000-0000-4000-8000-000000000001",
} as const;

function customer(id: string, isManaged: boolean): Customer {
  return {
    id,
    name: isManaged ? "합성 관리 고객" : "합성 비관리 고객",
    birthDate: null,
    gender: null,
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
  customerId: ids.unmanaged,
  insurer: "합성 보험사",
  productName: "합성 제외 계약",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon: 1n,
  disclosurePlan: null,
  maturesOn: "2026-08-20",
  renewable: false,
  status: "합성 해지",
  isIncluded: false,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const consultation: Consultation = {
  id: ids.consultation,
  customerId: ids.unmanaged,
  consultedAt: "2026-08-05T15:00:00.000Z",
  content: null,
  nextContactOn: "2026-08-10",
  result: null,
  createdAt: timestamp,
  updatedAt: timestamp,
};

const schedule: CalendarScheduleDetail = {
  id: ids.schedule,
  title: "합성 일정",
  scheduledOn: "2026-08-11",
  scheduledTime: null,
  memo: null,
  customerId: null,
  isCompleted: false,
};

function readers() {
  return {
    customers: {
      list: vi.fn().mockResolvedValue([
        customer(ids.managed, true),
        customer(ids.unmanaged, false),
      ]),
    },
    insurance: {
      list: vi.fn().mockImplementation((customerId: string) =>
        Promise.resolve(customerId === ids.unmanaged ? [policy] : [])
      ),
    },
    consultations: {
      list: vi.fn().mockImplementation((customerId: string) =>
        Promise.resolve(customerId === ids.unmanaged ? [consultation] : [])
      ),
    },
    schedules: { list: vi.fn().mockResolvedValue([schedule]) },
  };
}

describe("CalendarApplication", () => {
  it("fans out public readers for every active customer exactly once", async () => {
    const source = readers();
    const application = new CalendarApplication(
      source.customers,
      source.insurance,
      source.consultations,
      source.schedules,
    );

    const result = await application.loadMonth({
      month: "2026-08",
      timeZone: "Asia/Seoul",
    });

    expect(source.customers.list).toHaveBeenCalledTimes(1);
    expect(source.schedules.list).toHaveBeenCalledWith({
      startOn: "2026-08-01",
      endBefore: "2026-09-01",
    });
    expect(source.insurance.list).toHaveBeenCalledTimes(2);
    expect(source.consultations.list).toHaveBeenCalledTimes(2);
    expect(source.insurance.list).toHaveBeenCalledWith(ids.unmanaged);
    const events = result.days.flatMap((day) => day.events);
    expect(events.find((event) => event.kind === "policy-maturity"))
      .toMatchObject({ sourceId: ids.policy, customerId: ids.unmanaged });
    expect(events.filter((event) => event.sourceId === ids.consultation))
      .toHaveLength(2);
    expect(events.find((event) => event.kind === "consultation"))
      .toMatchObject({ eventOn: "2026-08-06", scheduledTime: "00:00" });
  });

  it("rejects invalid queries before any feature read", async () => {
    const source = readers();
    const application = new CalendarApplication(
      source.customers,
      source.insurance,
      source.consultations,
      source.schedules,
    );

    await expect(application.loadMonth({
      month: "2026-8",
      timeZone: "Asia/Seoul",
    })).rejects.toBeInstanceOf(CalendarApplicationError);
    expect(source.customers.list).not.toHaveBeenCalled();
    expect(source.schedules.list).not.toHaveBeenCalled();
  });

  it("replaces any source failure with one privacy-safe total failure", async () => {
    const source = readers();
    source.insurance.list.mockRejectedValue(
      new Error("private-row-marker-calendar-009"),
    );
    const application = new CalendarApplication(
      source.customers,
      source.insurance,
      source.consultations,
      source.schedules,
    );

    let caught: unknown;
    try {
      await application.loadMonth({ month: "2026-08", timeZone: "Asia/Seoul" });
    } catch (error) {
      caught = error;
    }
    expect(caught).toBeInstanceOf(CalendarApplicationError);
    expect(calendarSafeMessage(caught)).toBe(
      "캘린더를 불러오지 못했습니다. 다시 시도해 주세요.",
    );
    expect(String(caught)).not.toContain("private-row-marker-calendar-009");
  });
});
