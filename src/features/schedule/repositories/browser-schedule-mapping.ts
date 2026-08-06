import {
  ScheduleSchema,
  StoredScheduleSchema,
  parseSchedule,
} from "../schemas/schedule-schema";
import type { Schedule } from "../types/schedule";
import { ScheduleRepositoryError } from "../types/schedule-error";
import type { StoredSchedule } from "./browser-schedule-storage";

export function parseStoredSchedule(value: unknown): StoredSchedule {
  const result = StoredScheduleSchema.safeParse(value);
  if (!result.success) {
    throw new ScheduleRepositoryError("일정 데이터를 저장할 수 없습니다.");
  }
  return result.data;
}

export function scheduleFromStored(schedule: StoredSchedule): Schedule {
  return parseSchedule(ScheduleSchema.parse({
    id: schedule.id,
    title: schedule.title,
    scheduledOn: schedule.scheduledOn,
    scheduledTime: schedule.scheduledTime,
    memo: schedule.memo,
    customerId: schedule.customerId,
    isCompleted: schedule.isCompleted,
    createdAt: schedule.createdAt,
    updatedAt: schedule.updatedAt,
  }));
}
