const E2E_REFERENCE_DATE_KEY = "bodam:e2e-dashboard-reference-date";
const E2E_REFERENCE_INSTANT_KEY = "bodam:e2e-dashboard-reference-instant";

export function resolvedLocalTimeZone(): string {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (!timeZone) throw new Error("local time zone is unavailable");
  new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  return timeZone;
}

export function currentDateOnly(timeZone: string, now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const values = new Map(parts.map((part) => [part.type, part.value]));
  const year = values.get("year");
  const month = values.get("month");
  const day = values.get("day");
  if (!year || !month || !day) throw new Error("local date is unavailable");
  return `${year}-${month}-${day}`;
}

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

export function millisecondsUntilNextLocalMidnight(now = new Date()): number {
  const next = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + 1,
    0,
    0,
    0,
    50,
  );
  return Math.max(1, next.getTime() - now.getTime());
}
