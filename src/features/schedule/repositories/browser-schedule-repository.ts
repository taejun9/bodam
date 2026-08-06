import { BrowserCustomerRepository } from "@/features/customer/repositories/browser-customer-repository";
import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";
import { withBrowserStorageMutation } from "@/shared/browser-storage-mutation";

import {
  parseScheduleId,
  parseScheduleInput,
  parseScheduleIsCompleted,
  parseScheduleQuery,
} from "../schemas/schedule-schema";
import { sortSchedules } from "../services/schedule-order";
import type {
  Schedule,
  ScheduleInput,
  ScheduleQuery,
} from "../types/schedule";
import { ScheduleRepositoryError } from "../types/schedule-error";
import {
  parseStoredSchedule,
  scheduleFromStored,
} from "./browser-schedule-mapping";
import {
  BrowserScheduleStorage,
  type ScheduleStoragePort,
  type StoredSchedule,
} from "./browser-schedule-storage";
import type { ScheduleRepository } from "./schedule-repository";

export interface BrowserScheduleRepositoryOptions {
  readonly storage?: ScheduleStoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly customerRepository?: Pick<CustomerRepository, "list">;
}

const defaultStorage = (): ScheduleStoragePort => {
  if (typeof window === "undefined") {
    throw new ScheduleRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const scheduleNotFound = (): ScheduleRepositoryError =>
  new ScheduleRepositoryError("일정을 찾을 수 없습니다.", "not_found");

const customerNotFound = (): ScheduleRepositoryError =>
  new ScheduleRepositoryError("활성 고객을 찾을 수 없습니다.", "customer_not_found");

export class BrowserScheduleRepository implements ScheduleRepository {
  private readonly store: BrowserScheduleStorage;
  private readonly storage: ScheduleStoragePort;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly customerRepository: Pick<CustomerRepository, "list">;

  constructor(options: BrowserScheduleRepositoryOptions = {}) {
    const storage = options.storage ?? defaultStorage();
    this.storage = storage;
    this.store = new BrowserScheduleStorage(storage);
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    this.customerRepository = options.customerRepository ??
      new BrowserCustomerRepository({ storage });
  }

  list(query: ScheduleQuery): Promise<Schedule[]> {
    const parsedQuery = parseScheduleQuery(query);
    return withBrowserStorageMutation(
      this.storage,
      () => this.listUnlocked(parsedQuery),
    );
  }

  create(input: ScheduleInput): Promise<Schedule> {
    const parsedInput = parseScheduleInput(input);
    return withBrowserStorageMutation(
      this.storage,
      () => this.createUnlocked(parsedInput),
    );
  }

  update(id: string, input: ScheduleInput): Promise<Schedule> {
    const parsedId = parseScheduleId(id);
    const parsedInput = parseScheduleInput(input);
    return withBrowserStorageMutation(
      this.storage,
      () => this.updateUnlocked(parsedId, parsedInput),
    );
  }

  setCompleted(id: string, isCompleted: boolean): Promise<Schedule> {
    const parsedId = parseScheduleId(id);
    const parsedCompleted = parseScheduleIsCompleted(isCompleted);
    return withBrowserStorageMutation(
      this.storage,
      () => this.setCompletedUnlocked(parsedId, parsedCompleted),
    );
  }

  remove(id: string): Promise<void> {
    const parsedId = parseScheduleId(id);
    return withBrowserStorageMutation(
      this.storage,
      () => this.removeUnlocked(parsedId),
    );
  }

  private async listUnlocked(query: ScheduleQuery): Promise<Schedule[]> {
    const candidates = this.store.load().filter((schedule) =>
      schedule.deletedAt === null &&
      schedule.scheduledOn >= query.startOn &&
      schedule.scheduledOn < query.endBefore
    );
    if (!candidates.some((schedule) => schedule.customerId !== null)) {
      return sortSchedules(candidates.map(scheduleFromStored));
    }
    const customerIds = await this.activeCustomerIds();
    return sortSchedules(
      candidates
        .filter((schedule) =>
          schedule.customerId === null || customerIds.has(schedule.customerId)
        )
        .map(scheduleFromStored),
    );
  }

  private async createUnlocked(input: ScheduleInput): Promise<Schedule> {
    await this.ensureActiveCustomer(input.customerId);
    const schedules = this.store.load();
    const id = this.createId();
    if (schedules.some((schedule) => schedule.id === id)) {
      throw new ScheduleRepositoryError("일정 식별자를 생성하지 못했습니다.");
    }
    const timestamp = this.now();
    const created = parseStoredSchedule({
      id,
      ...input,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.save([...schedules, created]);
    return scheduleFromStored(created);
  }

  private async updateUnlocked(
    id: string,
    input: ScheduleInput,
  ): Promise<Schedule> {
    const schedules = this.store.load();
    const { existing, index } = await this.visibleSchedule(schedules, id);
    await this.ensureActiveCustomer(input.customerId);
    const updated = parseStoredSchedule({
      ...existing,
      ...input,
      updatedAt: this.now(),
    });
    schedules[index] = updated;
    this.store.save(schedules);
    return scheduleFromStored(updated);
  }

  private async setCompletedUnlocked(
    id: string,
    isCompleted: boolean,
  ): Promise<Schedule> {
    const schedules = this.store.load();
    const { existing, index } = await this.visibleSchedule(schedules, id);
    const updated = parseStoredSchedule({
      ...existing,
      isCompleted,
      updatedAt: this.now(),
    });
    schedules[index] = updated;
    this.store.save(schedules);
    return scheduleFromStored(updated);
  }

  private async removeUnlocked(id: string): Promise<void> {
    const schedules = this.store.load();
    const { existing, index } = await this.visibleSchedule(schedules, id);
    const timestamp = this.now();
    schedules[index] = parseStoredSchedule({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.save(schedules);
  }

  private async visibleSchedule(
    schedules: readonly StoredSchedule[],
    id: string,
  ): Promise<{ existing: StoredSchedule; index: number }> {
    const index = schedules.findIndex((schedule) =>
      schedule.id === id && schedule.deletedAt === null
    );
    const existing = schedules[index];
    if (index < 0 || existing === undefined) throw scheduleNotFound();
    if (existing.customerId !== null) {
      const customerIds = await this.activeCustomerIds();
      if (!customerIds.has(existing.customerId)) throw scheduleNotFound();
    }
    return { existing, index };
  }

  private async ensureActiveCustomer(customerId: string | null): Promise<void> {
    if (customerId === null) return;
    if (!(await this.activeCustomerIds()).has(customerId)) throw customerNotFound();
  }

  private async activeCustomerIds(): Promise<Set<string>> {
    try {
      return new Set(
        (await this.customerRepository.list({})).map((customer) => customer.id),
      );
    } catch {
      throw new ScheduleRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
  }
}
