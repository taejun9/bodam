import {
  currentDateOnly,
  millisecondsUntilNextLocalMidnight,
  resolvedLocalTimeZone,
} from "@/shared/calendar-runtime";

const E2E_REFERENCE_DATE_KEY = "bodam:e2e-dashboard-reference-date";
const E2E_REFERENCE_INSTANT_KEY = "bodam:e2e-dashboard-reference-instant";

export { currentDateOnly, millisecondsUntilNextLocalMidnight, resolvedLocalTimeZone };

export function dashboardReferenceDate(timeZone: string, now = new Date()): string {
  if (typeof __BODAM_E2E__ !== "undefined" && __BODAM_E2E__) {
    const fixedDate = sessionStorage.getItem(E2E_REFERENCE_DATE_KEY);
    if (fixedDate) return fixedDate;
  }
  return currentDateOnly(timeZone, now);
}

export function dashboardReferenceInstant(now = new Date()): string {
  if (typeof __BODAM_E2E__ !== "undefined" && __BODAM_E2E__) {
    const fixedInstant = sessionStorage.getItem(E2E_REFERENCE_INSTANT_KEY);
    if (fixedInstant) return fixedInstant;
  }
  return now.toISOString();
}

export function hasDashboardReferenceDateOverride(): boolean {
  return typeof __BODAM_E2E__ !== "undefined"
    && __BODAM_E2E__
    && sessionStorage.getItem(E2E_REFERENCE_DATE_KEY) !== null;
}
