import type { CalendarWeekday } from "@/shared/calendar-date";

export type CalendarEventKind =
  | "consultation"
  | "insurance-age"
  | "next-contact"
  | "policy-maturity"
  | "schedule";

export interface CalendarMonthQuery {
  readonly month: string;
  readonly timeZone: string;
}

export interface CalendarScheduleRange {
  readonly startOn: string;
  readonly endBefore: string;
}

export interface CalendarCustomerOption {
  readonly id: string;
  readonly name: string;
}

export interface CalendarScheduleDetail {
  readonly id: string;
  readonly title: string;
  readonly scheduledOn: string;
  readonly scheduledTime: string | null;
  readonly memo: string | null;
  readonly customerId: string | null;
  readonly isCompleted: boolean;
}

export interface CalendarEvent {
  readonly id: string;
  readonly kind: CalendarEventKind;
  readonly eventOn: string;
  readonly scheduledTime: string | null;
  readonly title: string;
  readonly reason: string;
  readonly customerId: string | null;
  readonly customerName: string | null;
  readonly sourceId: string;
  readonly isCompleted: boolean | null;
}

export interface CalendarDay {
  readonly date: string;
  readonly weekday: CalendarWeekday;
  readonly events: readonly CalendarEvent[];
}

export interface CalendarMonthReadModel {
  readonly month: string;
  readonly timeZone: string;
  readonly startOn: string;
  readonly endBefore: string;
  readonly days: readonly CalendarDay[];
  readonly customers: readonly CalendarCustomerOption[];
  readonly schedules: readonly CalendarScheduleDetail[];
}
