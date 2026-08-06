export interface CalendarDateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

export interface CalendarMonthParts {
  readonly year: number;
  readonly month: number;
}

export interface CalendarMonthRange {
  readonly startOn: string;
  readonly endBefore: string;
}

export interface LocalDateTime {
  readonly date: string;
  readonly time: string;
}

export type CalendarWeekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

export const CALENDAR_VIEW_MIN_DATE = "0001-01-01";
export const CALENDAR_VIEW_MAX_DATE = "9998-12-31";

const DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const MONTH_PATTERN = /^(\d{4})-(\d{2})$/;
const UTC_INSTANT_PATTERN =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/;
const DAY_MILLISECONDS = 86_400_000;

const invalid = (field: string, message: string): RangeError =>
  new RangeError(`${field}: ${message}`);

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

export function daysInMonth(year: number, month: number): number {
  if (month === 2) return isLeapYear(year) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

const pad = (value: number, length = 2): string =>
  value.toString().padStart(length, "0");

export function formatCalendarDate(parts: CalendarDateParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}-${pad(parts.day)}`;
}

export function formatCalendarMonth(parts: CalendarMonthParts): string {
  return `${pad(parts.year, 4)}-${pad(parts.month)}`;
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

export function parseCalendarMonth(
  value: string,
  field = "month",
): CalendarMonthParts {
  const match = typeof value === "string" ? MONTH_PATTERN.exec(value) : null;
  if (match === null) {
    throw invalid(field, "YYYY-MM 형식의 실제 월이어야 합니다.");
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (year < 1 || year > 9_999 || month < 1 || month > 12) {
    throw invalid(field, "YYYY-MM 형식의 실제 월이어야 합니다.");
  }
  return { year, month };
}

function utcDate(parts: CalendarDateParts): Date {
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(parts.year, parts.month - 1, parts.day);
  return date;
}

export function calendarOrdinal(value: string): number {
  return Math.floor(
    utcDate(parseCalendarDate(value)).getTime() / DAY_MILLISECONDS,
  );
}

export function calendarDaysBetween(from: string, to: string): number {
  return calendarOrdinal(to) - calendarOrdinal(from);
}

export function addCalendarDays(value: string, days: number): string {
  if (!Number.isSafeInteger(days)) throw invalid("days", "정수여야 합니다.");
  const date = new Date((calendarOrdinal(value) + days) * DAY_MILLISECONDS);
  const year = date.getUTCFullYear();
  if (year < 1 || year > 9_999) {
    throw invalid("date", "지원하는 날짜 범위를 벗어났습니다.");
  }
  return formatCalendarDate({
    year,
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate(),
  });
}

export function addCalendarMonthsClamped(value: string, months: number): string {
  if (!Number.isSafeInteger(months)) throw invalid("months", "정수여야 합니다.");
  const source = parseCalendarDate(value);
  const monthIndex = source.year * 12 + source.month - 1 + months;
  const year = Math.floor(monthIndex / 12);
  const month = monthIndex - year * 12 + 1;
  if (year < 1 || year > 9_999) {
    throw invalid("date", "지원하는 날짜 범위를 벗어났습니다.");
  }
  return formatCalendarDate({
    year,
    month,
    day: Math.min(source.day, daysInMonth(year, month)),
  });
}

export function addCalendarMonths(value: string, months: number): string {
  const source = parseCalendarMonth(value);
  return addCalendarMonthsClamped(`${formatCalendarMonth(source)}-01`, months)
    .slice(0, 7);
}

export function calendarMonthRange(value: string): CalendarMonthRange {
  const month = formatCalendarMonth(parseCalendarMonth(value));
  return { startOn: `${month}-01`, endBefore: `${addCalendarMonths(month, 1)}-01` };
}

export function calendarWeekday(value: string): CalendarWeekday {
  return utcDate(parseCalendarDate(value)).getUTCDay() as CalendarWeekday;
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

export function utcInstantToLocalDateTime(
  value: string,
  timeZone: string,
): LocalDateTime {
  const instant = parseUtcInstant(value);
  assertValidTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    calendar: "gregory",
    numberingSystem: "latn",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((candidate) => candidate.type === type)?.value ?? "";
  const date = `${part("year")}-${part("month")}-${part("day")}`;
  const time = `${part("hour")}:${part("minute")}`;
  parseCalendarDate(date, "localDate");
  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    throw invalid("localTime", "HH:mm 형식의 실제 시간이어야 합니다.");
  }
  return { date, time };
}

export function utcInstantToLocalDate(value: string, timeZone: string): string {
  return utcInstantToLocalDateTime(value, timeZone).date;
}

export function isUtcInstantAfter(value: string, referenceInstant: string): boolean {
  return parseUtcInstant(value).getTime() >
    parseUtcInstant(referenceInstant, "referenceInstant").getTime();
}
