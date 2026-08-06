import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseSchedule,
  parseScheduleDeleteResult,
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
import type { ScheduleRepository } from "./schedule-repository";

export type ScheduleInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: ScheduleInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

function decodeCommandError(
  error: unknown,
): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}

function repositoryErrorFrom(error: unknown): ScheduleRepositoryError {
  if (error instanceof ScheduleRepositoryError) return error;
  const code = decodeCommandError(error)?.code.toLowerCase() ?? "";
  if (code.includes("customer_not_found")) {
    return new ScheduleRepositoryError(
      "활성 고객을 찾을 수 없습니다.",
      "customer_not_found",
    );
  }
  if (code.includes("schedule_not_found")) {
    return new ScheduleRepositoryError("일정을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new ScheduleRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new ScheduleRepositoryError("일정 데이터를 처리하지 못했습니다.");
}

export class TauriScheduleRepository implements ScheduleRepository {
  constructor(private readonly invokeCommand: ScheduleInvoke = defaultInvoke) {}

  async list(query: ScheduleQuery): Promise<Schedule[]> {
    const parsedQuery = parseScheduleQuery(query);
    return this.execute(async () =>
      sortSchedules(parseScheduleList(
        await this.invokeCommand<unknown>("list_schedules", {
          startOn: parsedQuery.startOn,
          endBefore: parsedQuery.endBefore,
        }),
      ))
    );
  }

  async create(input: ScheduleInput): Promise<Schedule> {
    const parsedInput = parseScheduleInput(input);
    return this.execute(async () =>
      parseSchedule(
        await this.invokeCommand<unknown>("create_schedule", {
          input: parsedInput,
        }),
      )
    );
  }

  async update(id: string, input: ScheduleInput): Promise<Schedule> {
    const parsedId = parseScheduleId(id);
    const parsedInput = parseScheduleInput(input);
    return this.execute(async () =>
      parseSchedule(
        await this.invokeCommand<unknown>("update_schedule", {
          id: parsedId,
          input: parsedInput,
        }),
      )
    );
  }

  async setCompleted(id: string, isCompleted: boolean): Promise<Schedule> {
    const parsedId = parseScheduleId(id);
    const parsedCompleted = parseScheduleIsCompleted(isCompleted);
    return this.execute(async () =>
      parseSchedule(
        await this.invokeCommand<unknown>("set_schedule_completed", {
          id: parsedId,
          isCompleted: parsedCompleted,
        }),
      )
    );
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseScheduleId(id);
    await this.execute(async () => {
      const result = parseScheduleDeleteResult(
        await this.invokeCommand<unknown>("delete_schedule", { id: parsedId }),
      );
      if (result.id !== parsedId) {
        throw new ScheduleRepositoryError("일정 삭제 응답을 확인할 수 없습니다.");
      }
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw repositoryErrorFrom(error);
    }
  }
}
