import { z } from "zod";

import { StoredScheduleSchema } from "../schemas/schedule-schema";
import { ScheduleRepositoryError } from "../types/schedule-error";

export interface ScheduleStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoredSchedule = z.infer<typeof StoredScheduleSchema>;

export const BROWSER_SCHEDULE_STORAGE_KEY =
  "bodam.preview.synthetic-schedules.v1";

const storedScheduleListSchema = z
  .array(StoredScheduleSchema)
  .refine((schedules) => {
    const ids = new Set(schedules.map((schedule) => schedule.id));
    return ids.size === schedules.length;
  });

export class BrowserScheduleStorage {
  constructor(private readonly storage: ScheduleStoragePort) {}

  load(): StoredSchedule[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_SCHEDULE_STORAGE_KEY);
    } catch {
      throw new ScheduleRepositoryError(
        "미리보기 일정 저장소를 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }
    if (serialized === null) return [];

    try {
      const result = storedScheduleListSchema.safeParse(JSON.parse(serialized));
      if (result.success) return result.data;
    } catch {
      // Corrupt storage is reported without exposing its contents.
    }
    throw new ScheduleRepositoryError(
      "저장된 미리보기 일정 데이터를 읽을 수 없습니다.",
      "storage_corrupt",
    );
  }

  save(schedules: readonly StoredSchedule[]): void {
    try {
      this.storage.setItem(BROWSER_SCHEDULE_STORAGE_KEY, JSON.stringify(schedules));
    } catch {
      throw new ScheduleRepositoryError(
        "미리보기 일정 저장소에 저장할 수 없습니다.",
        "storage_unavailable",
      );
    }
  }
}
