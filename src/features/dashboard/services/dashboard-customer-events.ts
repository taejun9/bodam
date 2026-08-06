import type {
  DashboardConsultationFact,
  DashboardCustomerFacts,
  InsuranceAgeItem,
  MaturityItem,
  RecentConsultationItem,
  TodayContactItem,
  UnconsultedItem,
  UpcomingBucket,
} from "../types/dashboard";
import {
  calendarDaysBetween,
  isUtcInstantAfter,
  nextInsuranceAgeEvent,
  upcomingBucket,
  utcInstantToLocalDate,
} from "./dashboard-date";

interface LatestConsultation {
  readonly consultation: DashboardConsultationFact;
  readonly consultedOn: string;
}

const compareText = (left: string, right: string): number => {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
};

function latestConsultation(
  customer: DashboardCustomerFacts,
  referenceDate: string,
  referenceInstant: string,
  timeZone: string,
): LatestConsultation | null {
  const eligible = customer.consultations.flatMap((consultation) => {
    if (isUtcInstantAfter(consultation.consultedAt, referenceInstant)) return [];
    const consultedOn = utcInstantToLocalDate(consultation.consultedAt, timeZone);
    return consultedOn <= referenceDate ? [{ consultation, consultedOn }] : [];
  });
  eligible.sort((left, right) =>
    compareText(right.consultation.consultedAt, left.consultation.consultedAt) ||
    compareText(left.consultation.consultationId, right.consultation.consultationId)
  );
  return eligible[0] ?? null;
}

function eventReason(daysUntil: number, label: string): string {
  return daysUntil === 0 ? `오늘 ${label}` : `${daysUntil}일 후 ${label}`;
}

function bucketOrThrow(daysUntil: number): UpcomingBucket {
  const bucket = upcomingBucket(daysUntil);
  if (bucket === null) throw new RangeError("daysUntil: 예정 구간을 벗어났습니다.");
  return bucket;
}

export function buildTodayContactItems(
  customers: readonly DashboardCustomerFacts[],
  referenceDate: string,
  referenceInstant: string,
  timeZone: string,
): TodayContactItem[] {
  return customers.flatMap<TodayContactItem>((customer) => {
    const latest = latestConsultation(
      customer,
      referenceDate,
      referenceInstant,
      timeZone,
    );
    if (latest === null) return [];
    const nextContactOn = latest.consultation.nextContactOn;
    if (nextContactOn === null || nextContactOn > referenceDate) {
      return [];
    }
    const daysOverdue = calendarDaysBetween(nextContactOn, referenceDate);
    return [{
      customerId: customer.customerId,
      customerName: customer.customerName,
      consultationId: latest.consultation.consultationId,
      consultedAt: latest.consultation.consultedAt,
      nextContactOn,
      daysOverdue,
      reason: daysOverdue === 0 ? "오늘 연락 예정" : `${daysOverdue}일 연체`,
    }];
  }).sort((left, right) =>
    compareText(left.nextContactOn, right.nextContactOn) ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.customerId, right.customerId)
  );
}

export function buildInsuranceAgeItems(
  customers: readonly DashboardCustomerFacts[],
  referenceDate: string,
): InsuranceAgeItem[] {
  return customers.flatMap((customer) => {
    if (customer.birthDate === null) return [];
    const event = nextInsuranceAgeEvent(customer.birthDate, referenceDate);
    if (event === null || upcomingBucket(event.daysUntil) === null) return [];
    return [{
      customerId: customer.customerId,
      customerName: customer.customerName,
      birthDate: customer.birthDate,
      eventOn: event.eventOn,
      daysUntil: event.daysUntil,
      bucket: bucketOrThrow(event.daysUntil),
      insuranceAgeYears: event.insuranceAgeYears,
      reason: `${eventReason(event.daysUntil, "상령")} · 보험나이 ${event.insuranceAgeYears}세`,
    }];
  }).sort((left, right) =>
    compareText(left.eventOn, right.eventOn) ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.customerId, right.customerId)
  );
}

export function buildMaturityItems(
  customers: readonly DashboardCustomerFacts[],
  referenceDate: string,
): MaturityItem[] {
  return customers.flatMap((customer) =>
    customer.policies.flatMap((policy) => {
      if (policy.maturesOn === null) return [];
      const daysUntil = calendarDaysBetween(referenceDate, policy.maturesOn);
      if (upcomingBucket(daysUntil) === null) return [];
      return [{
        customerId: customer.customerId,
        customerName: customer.customerName,
        policyId: policy.policyId,
        insurer: policy.insurer,
        productName: policy.productName,
        eventOn: policy.maturesOn,
        daysUntil,
        bucket: bucketOrThrow(daysUntil),
        reason: eventReason(daysUntil, "만기"),
      }];
    })
  ).sort((left, right) =>
    compareText(left.eventOn, right.eventOn) ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.policyId, right.policyId)
  );
}

export function buildRecentConsultationItems(
  customers: readonly DashboardCustomerFacts[],
  referenceDate: string,
  referenceInstant: string,
  timeZone: string,
  recentConsultationDays: number,
): RecentConsultationItem[] {
  return customers.flatMap((customer) => {
    const latest = latestConsultation(
      customer,
      referenceDate,
      referenceInstant,
      timeZone,
    );
    if (latest === null) return [];
    const daysAgo = calendarDaysBetween(latest.consultedOn, referenceDate);
    if (daysAgo >= recentConsultationDays) return [];
    return [{
      customerId: customer.customerId,
      customerName: customer.customerName,
      consultationId: latest.consultation.consultationId,
      consultedAt: latest.consultation.consultedAt,
      consultedOn: latest.consultedOn,
      daysAgo,
      reason: daysAgo === 0 ? "오늘 상담" : `${daysAgo}일 전 상담`,
    }];
  }).sort((left, right) =>
    compareText(right.consultedAt, left.consultedAt) ||
    compareText(left.customerName, right.customerName) ||
    compareText(left.customerId, right.customerId)
  );
}

export function buildUnconsultedItems(
  customers: readonly DashboardCustomerFacts[],
  referenceDate: string,
  referenceInstant: string,
  timeZone: string,
  unconsultedDays: number,
): UnconsultedItem[] {
  return customers.flatMap<UnconsultedItem>((customer) => {
    const latest = latestConsultation(
      customer,
      referenceDate,
      referenceInstant,
      timeZone,
    );
    if (latest === null) {
      return [{
        customerId: customer.customerId,
        customerName: customer.customerName,
        latestConsultationId: null,
        latestConsultedAt: null,
        latestConsultedOn: null,
        daysSince: null,
        reason: "상담 이력 없음",
      }];
    }
    const daysSince = calendarDaysBetween(latest.consultedOn, referenceDate);
    if (daysSince < unconsultedDays) return [];
    return [{
      customerId: customer.customerId,
      customerName: customer.customerName,
      latestConsultationId: latest.consultation.consultationId,
      latestConsultedAt: latest.consultation.consultedAt,
      latestConsultedOn: latest.consultedOn,
      daysSince,
      reason: `${daysSince}일간 상담 없음`,
    }];
  }).sort((left, right) => {
    const leftNever = left.latestConsultedOn === null;
    const rightNever = right.latestConsultedOn === null;
    if (leftNever !== rightNever) return leftNever ? -1 : 1;
    if (leftNever && rightNever) {
      return compareText(left.customerName, right.customerName) ||
        compareText(left.customerId, right.customerId);
    }
    return compareText(left.latestConsultedOn ?? "", right.latestConsultedOn ?? "") ||
      compareText(left.customerName, right.customerName) ||
      compareText(left.customerId, right.customerId);
  });
}
