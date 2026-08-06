import { CoverageBenchmarkValidationError } from "../types/coverage-benchmark-error";

interface DateParts {
  readonly year: number;
  readonly month: number;
  readonly day: number;
}

const calendarDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/;

function dateParts(value: string, field: string): DateParts {
  const match = calendarDatePattern.exec(value);
  const date = new Date(`${value}T00:00:00.000Z`);
  if (
    match === null ||
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    throw new CoverageBenchmarkValidationError([{
      field,
      message: "날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.",
    }]);
  }
  return {
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
  };
}

const isLeapYear = (year: number): boolean =>
  year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);

const compareDate = (left: DateParts, right: DateParts): number =>
  left.year - right.year || left.month - right.month || left.day - right.day;

export function calculateFullAge(
  birthDate: string | null,
  referenceDate: string,
): number | null {
  const reference = dateParts(referenceDate, "referenceDate");
  if (birthDate === null) return null;
  const birth = dateParts(birthDate, "birthDate");
  if (compareDate(birth, reference) > 0) return null;

  const anniversaryMonth = birth.month;
  const anniversaryDay = birth.month === 2 && birth.day === 29 &&
      !isLeapYear(reference.year)
    ? 28
    : birth.day;
  const beforeAnniversary = reference.month < anniversaryMonth ||
    (reference.month === anniversaryMonth && reference.day < anniversaryDay);
  return reference.year - birth.year - (beforeAnniversary ? 1 : 0);
}

export function currentLocalDateOnly(now: Date = new Date()): string {
  const year = now.getFullYear().toString().padStart(4, "0");
  const month = (now.getMonth() + 1).toString().padStart(2, "0");
  const day = now.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}
