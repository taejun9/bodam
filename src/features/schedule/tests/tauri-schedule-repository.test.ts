import { describe, expect, it } from "vitest";

import {
  TauriScheduleRepository,
  type ScheduleInvoke,
} from "../repositories/tauri-schedule-repository";
import type { Schedule } from "../types/schedule";
import {
  SCHEDULE_CUSTOMER_IDS,
  SCHEDULE_IDS,
  schedule,
  scheduleInput,
} from "./schedule-test-data";

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

const query = { startOn: "2026-08-01", endBefore: "2026-09-01" };

function invocationHarness(overrides: Record<string, unknown> = {}) {
  const calls: Invocation[] = [];
  const responses: Record<string, unknown> = {
    list_schedules: [
      schedule(SCHEDULE_IDS[1], { scheduledTime: "09:00" }),
      schedule(SCHEDULE_IDS[0]),
    ],
    create_schedule: schedule(SCHEDULE_IDS[0]),
    update_schedule: schedule(SCHEDULE_IDS[0], { title: "합성 수정" }),
    set_schedule_completed: schedule(SCHEDULE_IDS[0], { isCompleted: true }),
    delete_schedule: { id: SCHEDULE_IDS[0] },
    ...overrides,
  };
  const invoke: ScheduleInvoke = <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => {
    calls.push({ command, args });
    return Promise.resolve(responses[command] as T);
  };
  return { calls, repository: new TauriScheduleRepository(invoke) };
}

describe("TauriScheduleRepository command contract", () => {
  it("uses exact commands, camelCase args, normalized inputs, and stable order", async () => {
    const { calls, repository } = invocationHarness();
    await expect(repository.list({
      startOn: " 2026-08-01 ",
      endBefore: " 2026-09-01 ",
    })).resolves.toMatchObject([
      { id: SCHEDULE_IDS[0] },
      { id: SCHEDULE_IDS[1] },
    ]);
    await repository.create(scheduleInput({
      title: "  합성 생성  ",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }));
    await repository.update(SCHEDULE_IDS[0], scheduleInput({
      memo: "  합성 수정 메모  ",
    }));
    await repository.setCompleted(SCHEDULE_IDS[0], true);
    await repository.remove(SCHEDULE_IDS[0]);

    expect(calls).toEqual([
      { command: "list_schedules", args: query },
      {
        command: "create_schedule",
        args: { input: scheduleInput({
          title: "합성 생성",
          customerId: SCHEDULE_CUSTOMER_IDS[0],
        }) },
      },
      {
        command: "update_schedule",
        args: {
          id: SCHEDULE_IDS[0],
          input: scheduleInput({ memo: "합성 수정 메모" }),
        },
      },
      {
        command: "set_schedule_completed",
        args: { id: SCHEDULE_IDS[0], isCompleted: true },
      },
      { command: "delete_schedule", args: { id: SCHEDULE_IDS[0] } },
    ]);
  });

  it("rejects malformed output and mismatched delete acknowledgements", async () => {
    const malformed = {
      ...schedule(SCHEDULE_IDS[0]),
      rogue: "synthetic-private-marker",
    } as Schedule;
    const { repository } = invocationHarness({
      list_schedules: [malformed],
      delete_schedule: { id: SCHEDULE_IDS[1] },
    });
    await expect(repository.list(query)).rejects.toMatchObject({
      code: "unexpected",
    });
    await expect(repository.remove(SCHEDULE_IDS[0])).rejects.toMatchObject({
      message: "일정 삭제 응답을 확인할 수 없습니다.",
    });
  });

  it.each([
    ["SCHEDULE_NOT_FOUND", "not_found"],
    ["CUSTOMER_NOT_FOUND", "customer_not_found"],
    ["VALIDATION_ERROR", "unexpected"],
  ])("maps native %s to safe %s errors", async (nativeCode, expectedCode) => {
    const invoke: ScheduleInvoke = () => Promise.reject({
      code: nativeCode,
      message: "synthetic private native detail",
    });
    const repository = new TauriScheduleRepository(invoke);
    await expect(repository.list(query)).rejects.toMatchObject({ code: expectedCode });
    await expect(repository.list(query))
      .rejects.not.toThrow("synthetic private native detail");
  });
});
