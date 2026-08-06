import { parseConsultedAt } from "../schemas/consultation-schema";
import { ConsultationValidationError } from "../types/consultation-error";

const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?$/;

const pad = (value: number, length = 2): string =>
  value.toString().padStart(length, "0");

function invalidLocalDateTime(): ConsultationValidationError {
  return new ConsultationValidationError([{
    field: "consultedAt",
    message: "상담 일시는 실제 local 날짜와 시간이어야 합니다.",
  }]);
}

function localDateTimeValue(date: Date): string {
  return `${pad(date.getFullYear(), 4)}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}` +
    `T${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.` +
    pad(date.getMilliseconds(), 3);
}

export function localDateTimeToUtcTimestamp(value: string): string {
  const match = localDateTimePattern.exec(value.trim());
  if (match === null) throw invalidLocalDateTime();

  const [year, month, day, hour, minute, second, millisecond] = match
    .slice(1)
    .map((part, index) => {
      if (index === 6) return Number((part ?? "0").padEnd(3, "0"));
      return Number(part ?? "0");
    });
  const date = new Date(
    year ?? 0,
    (month ?? 1) - 1,
    day ?? 0,
    hour ?? 0,
    minute ?? 0,
    second ?? 0,
    millisecond ?? 0,
  );
  if (
    Number.isNaN(date.getTime()) ||
    date.getFullYear() !== year ||
    date.getMonth() !== (month ?? 1) - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hour ||
    date.getMinutes() !== minute ||
    date.getSeconds() !== second ||
    date.getMilliseconds() !== millisecond
  ) {
    throw invalidLocalDateTime();
  }
  return date.toISOString();
}

export function utcTimestampToLocalDateTime(value: string): string {
  return localDateTimeValue(new Date(parseConsultedAt(value)));
}

export function currentLocalDateTimeValue(now: Date = new Date()): string {
  if (Number.isNaN(now.getTime())) throw invalidLocalDateTime();
  return localDateTimeValue(now).slice(0, 16);
}

export function formatConsultedAtLocal(value: string): string {
  const local = utcTimestampToLocalDateTime(value);
  return `${local.slice(0, 4)}. ${local.slice(5, 7)}. ${local.slice(8, 10)}. ` +
    `${local.slice(11, 16)}`;
}
