import {
  addCalendarMonthsClamped,
  daysInMonth,
  formatCalendarDate,
  parseCalendarDate,
  parseCalendarMonth,
  utcInstantToLocalDateTime,
} from "@/shared/calendar-date";

import type {
  CalendarEvent,
  CalendarMonthQuery,
  CalendarScheduleDetail,
} from "../types/calendar";
import type {
  CalendarConsultationSource,
  CalendarCustomerSource,
  CalendarPolicySource,
} from "../types/calendar-source";

interface MonthBounds {
  readonly startOn: string;
  readonly endBefore: string;
}

const inMonth = (date: string, bounds: MonthBounds): boolean =>
  date >= bounds.startOn && date < bounds.endBefore;

function insuranceAgeEvent(
  customer: CalendarCustomerSource,
  query: CalendarMonthQuery,
  bounds: MonthBounds,
): CalendarEvent | null {
  if (customer.birthDate === null) return null;
  const birth = parseCalendarDate(customer.birthDate, "birthDate");
  const visible = parseCalendarMonth(query.month);
  for (let birthdayYear = visible.year - 1;
    birthdayYear <= visible.year; birthdayYear += 1) {
    if (birthdayYear < birth.year || birthdayYear < 1) continue;
    const birthday = formatCalendarDate({
      year: birthdayYear,
      month: birth.month,
      day: Math.min(birth.day, daysInMonth(birthdayYear, birth.month)),
    });
    const eventOn = addCalendarMonthsClamped(birthday, 6);
    if (!inMonth(eventOn, bounds)) continue;
    const insuranceAgeYears = birthdayYear - birth.year + 1;
    return {
      id: `customer:${customer.customerId}:insurance-age:${eventOn}`,
      kind: "insurance-age",
      eventOn,
      scheduledTime: null,
      title: `${customer.customerName} 상령일`,
      reason: `보험나이 ${insuranceAgeYears}세`,
      customerId: customer.customerId,
      customerName: customer.customerName,
      sourceId: customer.customerId,
      isCompleted: null,
    };
  }
  return null;
}

function consultationEvents(
  customer: CalendarCustomerSource,
  consultation: CalendarConsultationSource,
  query: CalendarMonthQuery,
  bounds: MonthBounds,
): CalendarEvent[] {
  const events: CalendarEvent[] = [];
  const local = utcInstantToLocalDateTime(consultation.consultedAt, query.timeZone);
  if (inMonth(local.date, bounds)) {
    events.push({
      id: `consultation:${consultation.consultationId}:consulted`,
      kind: "consultation",
      eventOn: local.date,
      scheduledTime: local.time,
      title: `${customer.customerName} 상담`,
      reason: "상담일",
      customerId: customer.customerId,
      customerName: customer.customerName,
      sourceId: consultation.consultationId,
      isCompleted: null,
    });
  }
  if (consultation.nextContactOn !== null) {
    parseCalendarDate(consultation.nextContactOn, "nextContactOn");
    if (inMonth(consultation.nextContactOn, bounds)) {
      events.push({
        id: `consultation:${consultation.consultationId}:next-contact`,
        kind: "next-contact",
        eventOn: consultation.nextContactOn,
        scheduledTime: null,
        title: `${customer.customerName} 다음 연락`,
        reason: "다음 연락일",
        customerId: customer.customerId,
        customerName: customer.customerName,
        sourceId: consultation.consultationId,
        isCompleted: null,
      });
    }
  }
  return events;
}

function maturityEvent(
  customer: CalendarCustomerSource,
  policy: CalendarPolicySource,
  bounds: MonthBounds,
): CalendarEvent | null {
  if (policy.maturesOn === null) return null;
  parseCalendarDate(policy.maturesOn, "maturesOn");
  if (!inMonth(policy.maturesOn, bounds)) return null;
  return {
    id: `policy:${policy.policyId}:maturity`,
    kind: "policy-maturity",
    eventOn: policy.maturesOn,
    scheduledTime: null,
    title: `${customer.customerName} · ${policy.productName}`,
    reason: `${policy.insurer} 계약 만기`,
    customerId: customer.customerId,
    customerName: customer.customerName,
    sourceId: policy.policyId,
    isCompleted: null,
  };
}

export function buildCustomerCalendarEvents(
  customer: CalendarCustomerSource,
  query: CalendarMonthQuery,
  bounds: MonthBounds,
): CalendarEvent[] {
  const events = customer.consultations.flatMap((consultation) =>
    consultationEvents(customer, consultation, query, bounds)
  );
  events.push(...customer.policies.flatMap((policy) => {
    const event = maturityEvent(customer, policy, bounds);
    return event === null ? [] : [event];
  }));
  const insuranceAge = insuranceAgeEvent(customer, query, bounds);
  if (insuranceAge !== null) events.push(insuranceAge);
  return events;
}

export function buildScheduleCalendarEvent(
  schedule: CalendarScheduleDetail,
  customerName: string | null,
): CalendarEvent {
  parseCalendarDate(schedule.scheduledOn, "scheduledOn");
  if (
    schedule.scheduledTime !== null &&
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(schedule.scheduledTime)
  ) {
    throw new RangeError("scheduledTime: HH:mm 형식의 실제 시간이어야 합니다.");
  }
  if (typeof schedule.title !== "string" || schedule.title.length === 0) {
    throw new RangeError("title: 필수 문자열이어야 합니다.");
  }
  return {
    id: `schedule:${schedule.id}`,
    kind: "schedule",
    eventOn: schedule.scheduledOn,
    scheduledTime: schedule.scheduledTime,
    title: schedule.title,
    reason: schedule.isCompleted ? "완료한 사용자 일정" : "사용자 일정",
    customerId: schedule.customerId,
    customerName,
    sourceId: schedule.id,
    isCompleted: schedule.isCompleted,
  };
}
