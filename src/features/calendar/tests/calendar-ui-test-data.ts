import {
  daysInMonth,
  formatCalendarDate,
  parseCalendarMonth,
  type CalendarWeekday,
} from "@/shared/calendar-date";

import type {
  CalendarDay,
  CalendarEvent,
  CalendarMonthReadModel,
  CalendarScheduleDetail,
} from "../types/calendar";

export const calendarUiIds = {
  customer: "a1000000-0000-4000-8000-000000000001",
  consultation: "a2000000-0000-4000-8000-000000000001",
  policy: "a3000000-0000-4000-8000-000000000001",
  schedule: "a4000000-0000-4000-8000-000000000001",
} as const;

export const calendarUiSchedule: CalendarScheduleDetail = {
  id: calendarUiIds.schedule,
  title: "합성 완료 일정",
  scheduledOn: "2026-08-06",
  scheduledTime: "15:30",
  memo: "합성 다음 단계",
  customerId: calendarUiIds.customer,
  isCompleted: true,
};

function event(
  input: Pick<CalendarEvent, "id" | "kind" | "sourceId" | "title" | "reason">
    & Partial<CalendarEvent>,
): CalendarEvent {
  return {
    eventOn: "2026-08-06",
    scheduledTime: null,
    customerId: calendarUiIds.customer,
    customerName: "합성 달력 고객",
    isCompleted: null,
    ...input,
  };
}

export const calendarUiEvents: readonly CalendarEvent[] = [
  event({
    id: `consultation:${calendarUiIds.consultation}:next-contact`,
    kind: "next-contact",
    sourceId: calendarUiIds.consultation,
    title: "합성 달력 고객 다음 연락",
    reason: "다음 연락일",
  }),
  event({
    id: `customer:${calendarUiIds.customer}:insurance-age:2026-08-06`,
    kind: "insurance-age",
    sourceId: calendarUiIds.customer,
    title: "합성 달력 고객 상령일",
    reason: "보험나이 27세",
  }),
  event({
    id: `policy:${calendarUiIds.policy}:maturity`,
    kind: "policy-maturity",
    sourceId: calendarUiIds.policy,
    title: "합성 달력 고객 · 합성 계약",
    reason: "합성 보험사 계약 만기",
  }),
  event({
    id: `consultation:${calendarUiIds.consultation}:consulted`,
    kind: "consultation",
    sourceId: calendarUiIds.consultation,
    title: "합성 달력 고객 상담",
    reason: "상담일",
    scheduledTime: "10:20",
  }),
  event({
    id: `schedule:${calendarUiIds.schedule}`,
    kind: "schedule",
    sourceId: calendarUiIds.schedule,
    title: calendarUiSchedule.title,
    reason: "완료한 사용자 일정",
    scheduledTime: calendarUiSchedule.scheduledTime,
    isCompleted: true,
  }),
];

export function calendarDays(month: string, events: readonly CalendarEvent[] = []): CalendarDay[] {
  const parsed = parseCalendarMonth(month);
  return Array.from({ length: daysInMonth(parsed.year, parsed.month) }, (_, index) => {
    const date = formatCalendarDate({
      year: parsed.year,
      month: parsed.month,
      day: index + 1,
    });
    return {
      date,
      weekday: new Date(`${date}T00:00:00.000Z`).getUTCDay() as CalendarWeekday,
      events: events.filter((candidate) => candidate.eventOn === date),
    };
  });
}

export function calendarUiModel(
  month = "2026-08",
  events: readonly CalendarEvent[] = calendarUiEvents,
): CalendarMonthReadModel {
  const schedules = events.some((candidate) => candidate.kind === "schedule")
    ? [calendarUiSchedule]
    : [];
  const startOn = `${month}-01`;
  const parsed = parseCalendarMonth(month);
  const nextYear = parsed.month === 12 ? parsed.year + 1 : parsed.year;
  const nextMonth = parsed.month === 12 ? 1 : parsed.month + 1;
  return {
    month,
    timeZone: "Asia/Seoul",
    startOn,
    endBefore: `${String(nextYear).padStart(4, "0")}-${String(nextMonth).padStart(2, "0")}-01`,
    days: calendarDays(month, events),
    customers: [{ id: calendarUiIds.customer, name: "합성 달력 고객" }],
    schedules,
  };
}
