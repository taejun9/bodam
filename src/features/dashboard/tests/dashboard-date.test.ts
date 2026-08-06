import { describe, expect, it } from "vitest";

import {
  addCalendarDays,
  addCalendarMonthsClamped,
  calendarDaysBetween,
  isUtcInstantAfter,
  nextInsuranceAgeEvent,
  parseCalendarDate,
  upcomingBucket,
  utcInstantToLocalDate,
  validateDashboardQuery,
} from "../services/dashboard-date";

describe("dashboard calendar dates", () => {
  it("accepts only canonical real date-only values", () => {
    expect(parseCalendarDate("2024-02-29")).toEqual({
      year: 2024,
      month: 2,
      day: 29,
    });
    for (const invalid of [
      "2023-02-29",
      "2026-04-31",
      "2026-8-06",
      "0000-01-01",
      " 2026-08-06",
    ]) {
      expect(() => parseCalendarDate(invalid)).toThrow("실제 날짜");
    }
  });

  it("uses calendar ordinals across leap days and DST-shaped dates", () => {
    expect(calendarDaysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(calendarDaysBetween("2026-03-08", "2026-03-09")).toBe(1);
    expect(calendarDaysBetween("2026-01-01", "2025-12-31")).toBe(-1);
    expect(addCalendarDays("2024-02-28", 2)).toBe("2024-03-01");
    expect(addCalendarDays("2026-01-01", -1)).toBe("2025-12-31");
  });

  it("clamps calendar month addition at month and year boundaries", () => {
    expect(addCalendarMonthsClamped("2024-08-31", 6)).toBe("2025-02-28");
    expect(addCalendarMonthsClamped("2023-08-31", 6)).toBe("2024-02-29");
    expect(addCalendarMonthsClamped("2025-12-31", 2)).toBe("2026-02-28");
    expect(addCalendarMonthsClamped("2026-03-31", -1)).toBe("2026-02-28");
    expect(() => addCalendarMonthsClamped("2026-01-01", 1.5)).toThrow("정수");
  });

  it("converts canonical UTC instants at the supplied IANA timezone boundary", () => {
    expect(utcInstantToLocalDate(
      "2026-08-05T14:59:59.999Z",
      "Asia/Seoul",
    )).toBe("2026-08-05");
    expect(utcInstantToLocalDate(
      "2026-08-05T15:00:00.000Z",
      "Asia/Seoul",
    )).toBe("2026-08-06");
    expect(utcInstantToLocalDate(
      "2026-03-08T04:59:59.999Z",
      "America/New_York",
    )).toBe("2026-03-07");
    expect(utcInstantToLocalDate(
      "2026-03-08T05:00:00.000Z",
      "America/New_York",
    )).toBe("2026-03-08");
  });

  it("strictly validates UTC instants and allows exact future comparison", () => {
    expect(isUtcInstantAfter(
      "2026-08-06T00:00:00.001Z",
      "2026-08-06T00:00:00.000Z",
    )).toBe(true);
    expect(isUtcInstantAfter(
      "2026-08-06T00:00:00.000Z",
      "2026-08-06T00:00:00.000Z",
    )).toBe(false);
    expect(() => utcInstantToLocalDate(
      "2026-08-06T09:00:00+09:00",
      "Asia/Seoul",
    )).toThrow("UTC timestamp");
    expect(() => utcInstantToLocalDate(
      "2026-02-30T00:00:00.000Z",
      "Asia/Seoul",
    )).toThrow("실제 UTC");
  });

  it("calculates the next insurance-age event and age on its inclusive day", () => {
    expect(nextInsuranceAgeEvent("2000-02-20", "2026-08-19")).toEqual({
      eventOn: "2026-08-20",
      daysUntil: 1,
      insuranceAgeYears: 27,
    });
    expect(nextInsuranceAgeEvent("2000-02-20", "2026-08-20")).toEqual({
      eventOn: "2026-08-20",
      daysUntil: 0,
      insuranceAgeYears: 27,
    });
    expect(nextInsuranceAgeEvent("2000-08-31", "2025-02-28")).toEqual({
      eventOn: "2025-02-28",
      daysUntil: 0,
      insuranceAgeYears: 25,
    });
    expect(nextInsuranceAgeEvent("2000-02-29", "2026-08-28")).toEqual({
      eventOn: "2026-08-28",
      daysUntil: 0,
      insuranceAgeYears: 27,
    });
    expect(nextInsuranceAgeEvent("2030-01-01", "2026-08-06")).toBeNull();
  });

  it("uses non-overlapping inclusive 30/60/90 buckets", () => {
    expect([0, 30, 31, 60, 61, 90, 91].map(upcomingBucket)).toEqual([
      "0-30",
      "0-30",
      "31-60",
      "31-60",
      "61-90",
      "61-90",
      null,
    ]);
    expect(upcomingBucket(-1)).toBeNull();
  });

  it("validates query date, IANA timezone, and the approved maximum", () => {
    const query = {
      referenceDate: "2026-08-06",
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "Asia/Seoul",
      limit: 10,
    } as const;
    expect(validateDashboardQuery(query)).toEqual(query);
    expect(() => validateDashboardQuery({ ...query, limit: 0 })).toThrow("limit");
    expect(() => validateDashboardQuery({ ...query, limit: 11 })).toThrow("limit");
    expect(() => validateDashboardQuery({
      ...query,
      referenceDate: "2026-02-30",
    })).toThrow("referenceDate");
    expect(() => validateDashboardQuery({
      ...query,
      timeZone: "not/a-zone",
    })).toThrow("timeZone");
    expect(() => validateDashboardQuery({
      ...query,
      referenceInstant: "2026-08-05T14:59:59.999Z",
    })).toThrow("referenceInstant");
  });
});
