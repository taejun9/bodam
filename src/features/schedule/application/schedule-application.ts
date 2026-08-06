import type { Customer } from "@/features/customer/types/customer";

import type { ScheduleRepository } from "../repositories/schedule-repository";
import {
  parseSchedule,
  parseScheduleId,
  parseScheduleInput,
  parseScheduleIsCompleted,
  parseScheduleList,
  parseScheduleQuery,
} from "../schemas/schedule-schema";
import { sortSchedules } from "../services/schedule-order";
import type {
  Schedule,
  ScheduleInput,
  ScheduleQuery,
} from "../types/schedule";
import { ScheduleRepositoryError } from "../types/schedule-error";

export interface ScheduleCustomerReader {
  list(search?: string): Promise<readonly Customer[]>;
}

export class ScheduleApplication {
  constructor(
    private readonly repository: ScheduleRepository,
    private readonly customers: ScheduleCustomerReader,
  ) {}

  async list(query: ScheduleQuery): Promise<Schedule[]> {
    const parsedQuery = parseScheduleQuery(query);
    const schedules = parseScheduleList(await this.repository.list(parsedQuery));
    if (!schedules.some((schedule) => schedule.customerId !== null)) {
      return sortSchedules(schedules);
    }
    const customerIds = await this.activeCustomerIds();
    return sortSchedules(schedules.filter((schedule) =>
      schedule.customerId === null || customerIds.has(schedule.customerId)
    ));
  }

  async create(input: ScheduleInput): Promise<Schedule> {
    const parsedInput = parseScheduleInput(input);
    await this.ensureActiveCustomer(parsedInput.customerId);
    return parseSchedule(await this.repository.create(parsedInput));
  }

  async update(id: string, input: ScheduleInput): Promise<Schedule> {
    const parsedId = parseScheduleId(id);
    const parsedInput = parseScheduleInput(input);
    await this.ensureActiveCustomer(parsedInput.customerId);
    return parseSchedule(await this.repository.update(parsedId, parsedInput));
  }

  async setCompleted(id: string, isCompleted: boolean): Promise<Schedule> {
    return parseSchedule(
      await this.repository.setCompleted(
        parseScheduleId(id),
        parseScheduleIsCompleted(isCompleted),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseScheduleId(id));
  }

  private async ensureActiveCustomer(customerId: string | null): Promise<void> {
    if (customerId === null) return;
    if (!(await this.activeCustomerIds()).has(customerId)) {
      throw new ScheduleRepositoryError(
        "활성 고객을 찾을 수 없습니다.",
        "customer_not_found",
      );
    }
  }

  private async activeCustomerIds(): Promise<Set<string>> {
    let customers: readonly Customer[];
    try {
      customers = await this.customers.list();
    } catch {
      throw new ScheduleRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
    return new Set(customers.map((customer) => customer.id));
  }
}
