import {
  addCalendarDays,
  assertValidTimeZone,
  calendarMonthRange,
  calendarWeekday,
} from "@/shared/calendar-date";

import type {
  CalendarCustomerOption,
  CalendarDay,
  CalendarEvent,
  CalendarMonthQuery,
  CalendarMonthReadModel,
  CalendarScheduleDetail,
} from "../types/calendar";
import type { CalendarSources } from "../types/calendar-source";
import {
  buildCustomerCalendarEvents,
  buildScheduleCalendarEvent,
} from "./calendar-events";

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

export function compareCalendarEvents(
  left: CalendarEvent,
  right: CalendarEvent,
): number {
  return compareText(left.eventOn, right.eventOn) ||
    Number(left.scheduledTime !== null) - Number(right.scheduledTime !== null) ||
    compareText(left.scheduledTime ?? "", right.scheduledTime ?? "") ||
    compareText(left.kind, right.kind) ||
    compareText(left.title, right.title) ||
    compareText(left.id, right.id);
}

export function validateCalendarMonthQuery(
  query: CalendarMonthQuery,
): CalendarMonthQuery {
  calendarMonthRange(query.month);
  assertValidTimeZone(query.timeZone);
  return { ...query };
}

function scheduleOrder(
  left: CalendarScheduleDetail,
  right: CalendarScheduleDetail,
): number {
  return compareText(left.scheduledOn, right.scheduledOn) ||
    Number(left.scheduledTime !== null) - Number(right.scheduledTime !== null) ||
    compareText(left.scheduledTime ?? "", right.scheduledTime ?? "") ||
    compareText(left.title, right.title) ||
    compareText(left.id, right.id);
}

function activeSchedules(
  schedules: readonly CalendarScheduleDetail[],
  customerNames: ReadonlyMap<string, string>,
  startOn: string,
  endBefore: string,
): CalendarScheduleDetail[] {
  return schedules.filter((schedule) => {
    const linkedCustomerIsActive = schedule.customerId === null ||
      customerNames.has(schedule.customerId);
    return linkedCustomerIsActive && schedule.scheduledOn >= startOn &&
      schedule.scheduledOn < endBefore;
  }).map((schedule) => ({ ...schedule })).sort(scheduleOrder);
}

function groupDays(
  events: readonly CalendarEvent[],
  startOn: string,
  endBefore: string,
): CalendarDay[] {
  const byDate = new Map<string, CalendarEvent[]>();
  for (const event of events) {
    const day = byDate.get(event.eventOn) ?? [];
    day.push(event);
    byDate.set(event.eventOn, day);
  }
  const days: CalendarDay[] = [];
  for (let date = startOn; date < endBefore; date = addCalendarDays(date, 1)) {
    days.push({ date, weekday: calendarWeekday(date), events: byDate.get(date) ?? [] });
  }
  return days;
}

function assertUniqueEventIds(events: readonly CalendarEvent[]): void {
  const ids = new Set<string>();
  for (const event of events) {
    if (ids.has(event.id)) throw new RangeError("eventId: 중복될 수 없습니다.");
    ids.add(event.id);
  }
}

export function buildCalendarMonthReadModel(
  sources: CalendarSources,
  query: CalendarMonthQuery,
): CalendarMonthReadModel {
  const validated = validateCalendarMonthQuery(query);
  const { startOn, endBefore } = calendarMonthRange(validated.month);
  const customers: CalendarCustomerOption[] = sources.customers.map((customer) => ({
    id: customer.customerId,
    name: customer.customerName,
  })).sort((left, right) =>
    compareText(left.name, right.name) || compareText(left.id, right.id)
  );
  const customerNames = new Map(customers.map((customer) => [
    customer.id,
    customer.name,
  ]));
  const schedules = activeSchedules(
    sources.schedules,
    customerNames,
    startOn,
    endBefore,
  );
  const events = sources.customers.flatMap((customer) =>
    buildCustomerCalendarEvents(customer, validated, { startOn, endBefore })
  );
  events.push(...schedules.map((schedule) => buildScheduleCalendarEvent(
    schedule,
    schedule.customerId === null
      ? null
      : customerNames.get(schedule.customerId) ?? null,
  )));
  events.sort(compareCalendarEvents);
  assertUniqueEventIds(events);
  return {
    month: validated.month,
    timeZone: validated.timeZone,
    startOn,
    endBefore,
    days: groupDays(events, startOn, endBefore),
    customers,
    schedules,
  };
}
