import { describe, expect, it } from "vitest";

import {
  addCalendarMonths,
  calendarMonthRange,
  calendarWeekday,
  parseCalendarMonth,
  utcInstantToLocalDateTime,
} from "./calendar-date";

describe("shared calendar date primitives", () => {
  it("validates canonical months and builds half-open ranges", () => {
    expect(parseCalendarMonth("2026-08")).toEqual({ year: 2026, month: 8 });
    expect(calendarMonthRange("2026-08")).toEqual({
      startOn: "2026-08-01",
      endBefore: "2026-09-01",
    });
    expect(calendarMonthRange("2026-12").endBefore).toBe("2027-01-01");
    for (const value of ["2026-8", "2026-00", "2026-13", "0000-01", " 2026-08"])
      expect(() => parseCalendarMonth(value)).toThrow("실제 월");
  });

  it("moves calendar months and exposes Sunday-based weekdays", () => {
    expect(addCalendarMonths("2025-12", 1)).toBe("2026-01");
    expect(addCalendarMonths("2026-01", -1)).toBe("2025-12");
    expect(calendarWeekday("2026-08-01")).toBe(6);
    expect(calendarWeekday("2026-08-02")).toBe(0);
  });

  it("converts one UTC instant into the requested local date and minute", () => {
    expect(utcInstantToLocalDateTime(
      "2026-07-31T15:30:00.000Z",
      "Asia/Seoul",
    )).toEqual({ date: "2026-08-01", time: "00:30" });
    expect(utcInstantToLocalDateTime(
      "2026-03-08T06:59:00.000Z",
      "America/New_York",
    )).toEqual({ date: "2026-03-08", time: "01:59" });
    expect(utcInstantToLocalDateTime(
      "2026-03-08T07:00:00.000Z",
      "America/New_York",
    )).toEqual({ date: "2026-03-08", time: "03:00" });
  });
});
