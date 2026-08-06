import {
  DASHBOARD_MAX_ITEMS,
  type DashboardQuery,
  type UpcomingBucket,
} from "../types/dashboard";

export interface CalendarDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface InsuranceAgeEvent {
  readonly eventOn: string;
  readonly daysUntil: number;
  readonly insuranceAgeYears: number;
}

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MILLISECONDS = 86_400_000;

const invalid = (field: string, message: string): RangeError =>
  new RangeError(`${field}: ${message}`);

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const pad = (value: number, length = 2): string =>
  value.toString().padStart(length, "0");

function formatDate(parts: CalendarDateParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function parseCalendarDate(
  value: string,
  field = "date",
): CalendarDateParts {
  const match = typeof value === "string" ? DATE_PATTERN.exec(value) : null;
  if (match === null) {
    throw invalid(field, "YYYY-MM-DD 형식의 실제 날짜여야 합니다.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (
    year < 1 || year > 9_999 || month < 1 || month > 12 ||
    day < 1 || day > daysInMonth(year, month)
  ) {
    throw invalid(field, "YYYY-MM-DD 형식의 실제 날짜여야 합니다.");
  }
  return { year, month, day };
}

function utcDate(parts: CalendarDateParts): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date;
}

export function calendarOrdinal(value: string): number {
  return Math.floor(utcDate(parseCalendarDate(value)).getTime() / DAY_MILLISECONDS);
}

export function calendarDaysBetween(from: string, to: string): number {
  return calendarOrdinal(to) - calendarOrdinal(from);
}

export function addCalendarDays(value: string, days: number): string {
  if (!Number.isSafeInteger(days)) {
    throw invalid("days", "정수여야 합니다.");
  }
  const date = new Date((calendarOrdinal(value) + days) * DAY_MILLISECONDS);
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9_999) {
    throw invalid("date", "지원하는 날짜 범위를 벗어났습니다.");
  }
  return formatDate({
    year,
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addCalendarMonthsClamped(value: string, months: number): string {
  if (!Number.isSafeInteger(months)) {
    throw invalid("months", "정수여야 합니다.");
  }
  const source = parseCalendarDate(value);
  const monthIndex = source.year * 12 + source.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  if (year < 1 || year > 9_999) {
    throw invalid("date", "지원하는 날짜 범위를 벗어났습니다.");
  }
  return formatDate({
    year,
    month,
    day: Math.min(source.day, daysInMonth(year, month)),
  });
}

export function assertValidTimeZone(timeZone: string): void {
  if (typeof timeZone !== "string" || timeZone.length === 0) {
    throw invalid("timeZone", "유효한 IANA timezone이어야 합니다.");
  }
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(0);
  } catch {
    throw invalid("timeZone", "유효한 IANA timezone이어야 합니다.");
  }
}

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

export function utcInstantToLocalDate(value: string, timeZone: string): string {
  const instant = parseUtcInstant(value);
  assertValidTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const result = `${part("year")}-${part("month")}-${part("day")}`;
  parseCalendarDate(result, "localDate");
  return result;
}

export function isUtcInstantAfter(value: string, referenceInstant: string): boolean {
  return parseUtcInstant(value).getTime() >
    parseUtcInstant(referenceInstant, "referenceInstant").getTime();
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
  const birthday = formatDate({
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
