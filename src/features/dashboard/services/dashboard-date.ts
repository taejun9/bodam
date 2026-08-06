import {
  DASHBOARD_MAX_ITEMS,
  type DashboardQuery,
  type UpcomingBucket,
} from "../types/dashboard";
import {
  addCalendarMonthsClamped,
  assertValidTimeZone,
  calendarDaysBetween,
  daysInMonth,
  formatCalendarDate,
  parseCalendarDate,
  utcInstantToLocalDate,
  type CalendarDateParts,
} from "@/shared/calendar-date";

export {
  addCalendarDays,
  addCalendarMonthsClamped,
  assertValidTimeZone,
  calendarDaysBetween,
  calendarOrdinal,
  isUtcInstantAfter,
  parseCalendarDate,
  utcInstantToLocalDate,
  type CalendarDateParts,
} from "@/shared/calendar-date";

export interface InsuranceAgeEvent {
  readonly eventOn: string;
  readonly daysUntil: number;
  readonly insuranceAgeYears: number;
}

const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;

const invalid = (field: string, message: string): RangeError =>
  new RangeError(`${field}: ${message}`);


function parseUtcInstant(value: string, field = "instant"): Date {
  if (typeof value !== "string" || !UTC_INSTANT_PATTERN.test(value)) {
    throw invalid(field, "millisecond 정밀도의 UTC timestamp여야 합니다.");
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime()) || date.toISOString() !== value) {
    throw invalid(field, "실제 UTC timestamp여야 합니다.");
  }
  return date;
}


export function upcomingBucket(daysUntil: number): UpcomingBucket | null {
  if (!Number.isInteger(daysUntil) || daysUntil < 0 || daysUntil > 90) return null;
  if (daysUntil <= 30) return "0-30";
  return daysUntil <= 60 ? "31-60" : "61-90";
}

function insuranceEventForYear(
  birth: CalendarDateParts,
  birthdayYear: number,
): string {
  const birthday = formatCalendarDate({
    year: birthdayYear,
    month: birth.month,
    day: Math.min(birth.day, daysInMonth(birthdayYear, birth.month)),
  });
  return addCalendarMonthsClamped(birthday, 6);
}

export function nextInsuranceAgeEvent(
  birthDate: string,
  referenceDate: string,
): InsuranceAgeEvent | null {
  const birth = parseCalendarDate(birthDate, "birthDate");
  const reference = parseCalendarDate(referenceDate, "referenceDate");
  if (calendarDaysBetween(birthDate, referenceDate) < 0) return null;

  for (let birthdayYear = reference.year - 1;
    birthdayYear <= reference.year + 1; birthdayYear += 1) {
    if (birthdayYear < birth.year || birthdayYear < 1) continue;
    const eventOn = insuranceEventForYear(birth, birthdayYear);
    const daysUntil = calendarDaysBetween(referenceDate, eventOn);
    if (daysUntil >= 0) {
      return {
        eventOn,
        daysUntil,
        insuranceAgeYears: birthdayYear - birth.year + 1,
      };
    }
  }
  return null;
}

export function validateDashboardQuery(query: DashboardQuery): DashboardQuery {
  parseCalendarDate(query.referenceDate, "referenceDate");
  assertValidTimeZone(query.timeZone);
  parseUtcInstant(query.referenceInstant, "referenceInstant");
  if (utcInstantToLocalDate(query.referenceInstant, query.timeZone) !== query.referenceDate) {
    throw invalid("referenceInstant", "referenceDate의 local 날짜 안에 있어야 합니다.");
  }
  if (
    !Number.isInteger(query.limit) || query.limit < 1 ||
    query.limit > DASHBOARD_MAX_ITEMS
  ) {
    throw invalid("limit", `1 이상 ${DASHBOARD_MAX_ITEMS} 이하의 정수여야 합니다.`);
  }
  return { ...query };
}
