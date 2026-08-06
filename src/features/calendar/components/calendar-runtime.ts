import {
  currentDateOnly,
  millisecondsUntilNextLocalMidnight,
  resolvedLocalTimeZone,
} from "@/shared/calendar-runtime";

const E2E_REFERENCE_DATE_KEY = "bodam:e2e-calendar-reference-date";

export { millisecondsUntilNextLocalMidnight, resolvedLocalTimeZone };

export function calendarReferenceDate(timeZone: string, now = new Date()): string {
  if (typeof __BODAM_E2E__ !== "undefined" && __BODAM_E2E__) {
    const fixedDate = sessionStorage.getItem(E2E_REFERENCE_DATE_KEY);
    if (fixedDate) return fixedDate;
  }
  return currentDateOnly(timeZone, now);
}

export function hasCalendarReferenceDateOverride(): boolean {
  return typeof __BODAM_E2E__ !== "undefined"
    && __BODAM_E2E__
    && sessionStorage.getItem(E2E_REFERENCE_DATE_KEY) !== null;
}
