import { afterEach, describe, expect, it, vi } from "vitest";

import {
  currentDateOnly,
  dashboardReferenceDate,
  dashboardReferenceInstant,
  millisecondsUntilNextLocalMidnight,
} from "@/features/dashboard/components/dashboard-runtime";

describe("dashboard page runtime", () => {
  afterEach(() => vi.useRealTimers());

  it("resolves the same instant to the requested IANA local date", () => {
    const instant = new Date("2026-08-05T15:00:00.000Z");
    expect(currentDateOnly("Asia/Seoul", instant)).toBe("2026-08-06");
    expect(currentDateOnly("America/Los_Angeles", instant)).toBe("2026-08-05");
    expect(() => currentDateOnly("Invalid/TimeZone", instant)).toThrow();
  });

  it("uses the current local date safely when the E2E flag is unavailable", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-08-05T15:00:00.000Z"));
    expect(dashboardReferenceDate("Asia/Seoul")).toBe("2026-08-06");
    expect(dashboardReferenceInstant()).toBe("2026-08-05T15:00:00.000Z");
  });

  it("schedules a positive delay to the next OS-local midnight", () => {
    const now = new Date(2026, 7, 6, 23, 59, 59, 900);
    expect(millisecondsUntilNextLocalMidnight(now)).toBe(150);
  });
});
