import { describe, expect, it } from "vitest";

import { buildCalendarMonthReadModel } from "../services/calendar-read-model";
import type { CalendarSources } from "../types/calendar-source";

const ids = {
  customer: "91000000-0000-4000-8000-000000000001",
  otherCustomer: "91000000-0000-4000-8000-000000000002",
  missingCustomer: "91000000-0000-4000-8000-000000000003",
  policy: "92000000-0000-4000-8000-000000000001",
  consultation: "93000000-0000-4000-8000-000000000001",
  allDaySchedule: "94000000-0000-4000-8000-000000000001",
  timedSchedule: "94000000-0000-4000-8000-000000000002",
  hiddenSchedule: "94000000-0000-4000-8000-000000000003",
} as const;

function sources(): CalendarSources {
  return {
    customers: [{
      customerId: ids.customer,
      customerName: "합성 비관리 고객",
      birthDate: "2000-02-29",
      policies: [{
        policyId: ids.policy,
        insurer: "합성 보험사",
        productName: "합성 제외 계약",
        maturesOn: "2026-08-01",
      }],
      consultations: [{
        consultationId: ids.consultation,
        consultedAt: "2026-07-31T15:30:00.000Z",
        nextContactOn: "2026-08-01",
      }],
    }, {
      customerId: ids.otherCustomer,
      customerName: "가 합성 고객",
      birthDate: null,
      policies: [],
      consultations: [],
    }],
    schedules: [{
      id: ids.timedSchedule,
      title: "합성 오전 일정",
      scheduledOn: "2026-08-01",
      scheduledTime: "09:00",
      memo: "합성 메모",
      customerId: ids.customer,
      isCompleted: true,
    }, {
      id: ids.allDaySchedule,
      title: "합성 종일 일정",
      scheduledOn: "2026-08-01",
      scheduledTime: null,
      memo: null,
      customerId: null,
      isCompleted: false,
    }, {
      id: ids.hiddenSchedule,
      title: "합성 숨김 일정",
      scheduledOn: "2026-08-01",
      scheduledTime: null,
      memo: null,
      customerId: ids.missingCustomer,
      isCompleted: false,
    }],
  };
}

describe("calendar month read model", () => {
  it("builds five stable kinds and pre-grouped sorted month days", () => {
    const result = buildCalendarMonthReadModel(sources(), {
      month: "2026-08",
      timeZone: "Asia/Seoul",
    });

    expect(result.days).toHaveLength(31);
    expect(result.days[0]).toMatchObject({ date: "2026-08-01", weekday: 6 });
    expect(result.days.at(-1)?.date).toBe("2026-08-31");
    expect(result.customers.map((customer) => customer.id)).toEqual([
      ids.otherCustomer,
      ids.customer,
    ]);
    expect(result.schedules.map((schedule) => schedule.id)).toEqual([
      ids.allDaySchedule,
      ids.timedSchedule,
    ]);

    const firstDay = result.days[0]?.events ?? [];
    expect(firstDay.map((event) => [event.kind, event.scheduledTime])).toEqual([
      ["next-contact", null],
      ["policy-maturity", null],
      ["schedule", null],
      ["consultation", "00:30"],
      ["schedule", "09:00"],
    ]);
    expect(firstDay.map((event) => event.id)).toEqual([
      `consultation:${ids.consultation}:next-contact`,
      `policy:${ids.policy}:maturity`,
      `schedule:${ids.allDaySchedule}`,
      `consultation:${ids.consultation}:consulted`,
      `schedule:${ids.timedSchedule}`,
    ]);
    expect(firstDay.at(-1)).toMatchObject({
      customerName: "합성 비관리 고객",
      isCompleted: true,
      reason: "완료한 사용자 일정",
    });

    const insuranceAge = result.days.find((day) => day.date === "2026-08-28")
      ?.events[0];
    expect(insuranceAge).toMatchObject({
      id: `customer:${ids.customer}:insurance-age:2026-08-28`,
      kind: "insurance-age",
      reason: "보험나이 27세",
    });
  });

  it("keeps date-only and schedule wall time unchanged across timezones", () => {
    const seoul = buildCalendarMonthReadModel(sources(), {
      month: "2026-08",
      timeZone: "Asia/Seoul",
    });
    const newYork = buildCalendarMonthReadModel(sources(), {
      month: "2026-08",
      timeZone: "America/New_York",
    });
    const selected = (model: typeof seoul, kind: string) => model.days
      .flatMap((day) => day.events).find((event) => event.kind === kind);

    expect(selected(seoul, "consultation")?.eventOn).toBe("2026-08-01");
    expect(selected(newYork, "consultation")).toBeUndefined();
    for (const kind of ["next-contact", "policy-maturity", "schedule"])
      expect(selected(newYork, kind)?.eventOn).toBe(selected(seoul, kind)?.eventOn);
    expect(selected(newYork, "schedule")?.scheduledTime).toBeNull();
    expect(newYork.days[0]?.events.find((event) =>
      event.sourceId === ids.timedSchedule
    )?.scheduledTime).toBe("09:00");
  });

  it("clamps annual insurance-age events from month ends", () => {
    const original = sources();
    const input: CalendarSources = {
      ...original,
      customers: [
        { ...original.customers[0]!, birthDate: "2000-08-31" },
        ...original.customers.slice(1),
      ],
    };
    const result = buildCalendarMonthReadModel(input, {
      month: "2025-02",
      timeZone: "UTC",
    });
    const event = result.days.flatMap((day) => day.events)
      .find((candidate) => candidate.kind === "insurance-age");
    expect(event).toMatchObject({ eventOn: "2025-02-28", reason: "보험나이 25세" });
  });
});
