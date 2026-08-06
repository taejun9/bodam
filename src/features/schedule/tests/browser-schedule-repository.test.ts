import { describe, expect, it } from "vitest";

import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";
import type { Customer } from "@/features/customer/types/customer";

import { BrowserScheduleRepository } from "../repositories/browser-schedule-repository";
import { BROWSER_SCHEDULE_STORAGE_KEY } from "../repositories/browser-schedule-storage";
import { StoredScheduleSchema } from "../schemas/schedule-schema";
import {
  SCHEDULE_CUSTOMER_IDS,
  SCHEDULE_IDS,
  SCHEDULE_TIMESTAMP,
  scheduleCustomer,
  scheduleInput,
} from "./schedule-test-data";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const august = { startOn: "2026-08-01", endBefore: "2026-09-01" };

function customerRepository(
  customers: () => readonly Customer[],
): Pick<CustomerRepository, "list"> {
  return { list: () => Promise.resolve([...customers()]) };
}

function repository(
  storage: MemoryStorage,
  ids: readonly string[],
  customers: () => readonly Customer[] = () => [scheduleCustomer()],
): BrowserScheduleRepository {
  let index = 0;
  return new BrowserScheduleRepository({
    storage,
    customerRepository: customerRepository(customers),
    createId: () => ids[index++] ?? SCHEDULE_IDS[3],
    now: () => SCHEDULE_TIMESTAMP,
  });
}

function storedSchedules(storage: MemoryStorage) {
  return StoredScheduleSchema.array().parse(
    JSON.parse(storage.getItem(BROWSER_SCHEDULE_STORAGE_KEY) ?? "[]"),
  );
}

describe("BrowserScheduleRepository lifecycle", () => {
  it("persists CRUD, applies the half-open range, and sorts all-day first", async () => {
    const storage = new MemoryStorage();
    const schedules = repository(storage, SCHEDULE_IDS);
    const allDay = await schedules.create(scheduleInput({
      title: "나",
      scheduledOn: "2026-08-20",
    }));
    const later = await schedules.create(scheduleInput({
      title: "가",
      scheduledOn: "2026-08-20",
      scheduledTime: "10:00",
    }));
    const earlier = await schedules.create(scheduleInput({
      title: "다",
      scheduledOn: "2026-08-20",
      scheduledTime: "09:00",
    }));
    await schedules.create(scheduleInput({
      scheduledOn: "2026-09-01",
    }));

    await expect(schedules.list(august)).resolves.toMatchObject([
      { id: allDay.id },
      { id: earlier.id },
      { id: later.id },
    ]);
    const updated = await schedules.update(later.id, scheduleInput({
      title: "  수정 일정  ",
      scheduledOn: "2026-08-21",
      memo: "  수정 메모  ",
    }));
    const completed = await schedules.setCompleted(earlier.id, true);
    await schedules.remove(allDay.id);

    expect(updated).toMatchObject({ title: "수정 일정", memo: "수정 메모" });
    expect(completed.isCompleted).toBe(true);
    await expect(schedules.list(august)).resolves.toMatchObject([
      { id: earlier.id, isCompleted: true },
      { id: later.id, scheduledOn: "2026-08-21" },
    ]);
    const stored = storedSchedules(storage);
    expect(stored).toHaveLength(4);
    expect(stored.find(({ id }) => id === allDay.id)?.deletedAt)
      .toBe(SCHEDULE_TIMESTAMP);
  });

  it("hides inactive-parent rows while preserving unlinked schedules", async () => {
    const storage = new MemoryStorage();
    let activeCustomers: readonly Customer[] = [scheduleCustomer()];
    const schedules = repository(storage, SCHEDULE_IDS, () => activeCustomers);
    const linked = await schedules.create(scheduleInput({
      title: "연결 일정",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }));
    const unlinked = await schedules.create(scheduleInput({ title: "독립 일정" }));

    activeCustomers = [];
    await expect(schedules.list(august)).resolves.toMatchObject([
      { id: unlinked.id },
    ]);
    await expect(schedules.setCompleted(linked.id, true))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(schedules.remove(linked.id))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(schedules.update(unlinked.id, scheduleInput({
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }))).rejects.toMatchObject({ code: "customer_not_found" });
    expect(storedSchedules(storage)).toMatchObject([
      { id: linked.id, deletedAt: null },
      { id: unlinked.id, deletedAt: null },
    ]);
  });

  it("serializes concurrent whole-array writes on shared storage", async () => {
    const storage = new MemoryStorage();
    const first = repository(storage, [SCHEDULE_IDS[0]], () => []);
    const second = repository(storage, [SCHEDULE_IDS[1]], () => []);
    await Promise.all([
      first.create(scheduleInput({ title: "첫 일정" })),
      second.create(scheduleInput({ title: "둘째 일정" })),
    ]);
    expect(storedSchedules(storage).map(({ id }) => id)).toEqual([
      SCHEDULE_IDS[0],
      SCHEDULE_IDS[1],
    ]);
  });

  it("reports corrupt synthetic storage without exposing contents", async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_SCHEDULE_STORAGE_KEY, "synthetic-private-marker");
    await expect(repository(storage, SCHEDULE_IDS).list(august))
      .rejects.toMatchObject({
        code: "storage_corrupt",
        message: "저장된 미리보기 일정 데이터를 읽을 수 없습니다.",
      });
  });
});
