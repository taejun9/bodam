import type { CalendarEvent, CalendarEventKind } from "../types/calendar";

const kindLabels: Record<CalendarEventKind, string> = {
  consultation: "상담",
  "next-contact": "다음 연락",
  "insurance-age": "상령",
  "policy-maturity": "계약 만기",
  schedule: "사용자 일정",
};

export const calendarEventKindLabel = (kind: CalendarEventKind): string =>
  kindLabels[kind];

export function calendarMonthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return `${year}년 ${monthNumber}월`;
}

export function calendarDateLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

export function calendarShortDateLabel(date: string): string {
  const [, month, day] = date.split("-").map(Number);
  return `${month}월 ${day}일`;
}

export function calendarDayButtonLabel(
  date: string,
  weekday: number,
  eventCount: number,
): string {
  const weekdays = ["일요일", "월요일", "화요일", "수요일", "목요일", "금요일", "토요일"];
  return `${calendarDateLabel(date)} ${weekdays[weekday]}, 일정 ${eventCount}개`;
}

export function calendarEventDateTime(event: CalendarEvent): string {
  return event.scheduledTime
    ? `${event.eventOn}T${event.scheduledTime}:00`
    : event.eventOn;
}

export function calendarEventTimeLabel(event: CalendarEvent): string {
  return event.scheduledTime ?? "종일";
}
