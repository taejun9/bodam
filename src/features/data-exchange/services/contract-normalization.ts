import { isUnicodeScalarText } from "@/shared/text-normalization";

export const MAX_SOURCE_CELL_CHARS = 4_000;
export const MAX_DOMAIN_TEXT_CHARS = 200;
export const MAX_SQLITE_INTEGER = 9_223_372_036_854_775_807n;

export function unicodeScalarLength(value: string): number {
  return Array.from(value).length;
}

export function isBoundedUnicodeText(value: string, limit: number): boolean {
  return isUnicodeScalarText(value) && unicodeScalarLength(value) <= limit;
}

export function normalizeImportText(value: string): string {
  return value.trim().normalize("NFC");
}

export function normalizedOptionalText(value: string | null): string | null {
  if (value === null) return null;
  const normalized = normalizeImportText(value);
  return normalized.length === 0 ? null : normalized;
}

export function isCalendarDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  if (year < 1 || year > 9_999 || month < 1 || month > 12) return false;
  return day >= 1 && day <= daysInMonth(year, month);
}

export function isYearMonth(value: string): boolean {
  const match = /^(\d{4})(\d{2})$/.exec(value);
  if (match === null) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  return year >= 1 && year <= 9_999 && month >= 1 && month <= 12;
}

export function isAsciiDigits(value: string): boolean {
  return /^[0-9]+$/.test(value);
}

export function canonicalPremium(value: string): string | null {
  if (!isAsciiDigits(value)) return null;
  try {
    const amount = BigInt(value);
    return amount <= MAX_SQLITE_INTEGER ? amount.toString() : null;
  } catch {
    return null;
  }
}

function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
    return leap ? 29 : 28;
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}
