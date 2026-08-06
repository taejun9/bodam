import type { Customer } from "@/features/customer/types/customer";

import type { Schedule, ScheduleInput } from "../types/schedule";

export const SCHEDULE_IDS = [
  "91000000-0000-4000-8000-000000000001",
  "91000000-0000-4000-8000-000000000002",
  "91000000-0000-4000-8000-000000000003",
  "91000000-0000-4000-8000-000000000004",
] as const;

export const SCHEDULE_CUSTOMER_IDS = [
  "92000000-0000-4000-8000-000000000001",
  "92000000-0000-4000-8000-000000000002",
] as const;

export const SCHEDULE_TIMESTAMP = "2026-08-06T01:02:03.000Z";

export const scheduleInput = (
  overrides: Partial<ScheduleInput> = {},
): ScheduleInput => ({
  title: "합성 일정",
  scheduledOn: "2026-08-20",
  scheduledTime: null,
  memo: "합성 메모",
  customerId: null,
  isCompleted: false,
  ...overrides,
});

export const schedule = (
  id: string,
  overrides: Partial<ScheduleInput> = {},
): Schedule => ({
  id,
  ...scheduleInput(overrides),
  createdAt: SCHEDULE_TIMESTAMP,
  updatedAt: SCHEDULE_TIMESTAMP,
});

export const scheduleCustomer = (
  id = SCHEDULE_CUSTOMER_IDS[0],
): Customer => ({
  id,
  name: "합성 고객",
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: SCHEDULE_TIMESTAMP,
  updatedAt: SCHEDULE_TIMESTAMP,
});
