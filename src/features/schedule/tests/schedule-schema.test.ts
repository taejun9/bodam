import { describe, expect, it } from "vitest";

import {
  MAX_SCHEDULE_MEMO_CHARS,
  MAX_SCHEDULE_TITLE_CHARS,
  parseSchedule,
  parseScheduleInput,
  parseScheduleQuery,
} from "../schemas/schedule-schema";
import { ScheduleRepositoryError } from "../types/schedule-error";
import {
  SCHEDULE_CUSTOMER_IDS,
  SCHEDULE_IDS,
  schedule,
  scheduleInput,
} from "./schedule-test-data";

describe("Schedule schema", () => {
  it("normalizes form text and optional blank fields", () => {
    expect(parseScheduleInput({
      title: "  합성 일정 😀  ",
      scheduledOn: " 2026-08-20 ",
      scheduledTime: " 09:05 ",
      memo: "  합성 메모  ",
      customerId: ` ${SCHEDULE_CUSTOMER_IDS[0]} `,
      isCompleted: false,
    })).toEqual({
      title: "합성 일정 😀",
      scheduledOn: "2026-08-20",
      scheduledTime: "09:05",
      memo: "합성 메모",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
      isCompleted: false,
    });
    expect(parseScheduleInput({
      ...scheduleInput(),
      scheduledTime: " ",
      memo: " ",
      customerId: " ",
    })).toMatchObject({ scheduledTime: null, memo: null, customerId: null });
  });

  it("counts Unicode scalars and rejects malformed or excess text", () => {
    expect(() => parseScheduleInput(scheduleInput({
      title: "😀".repeat(MAX_SCHEDULE_TITLE_CHARS),
      memo: "😀".repeat(MAX_SCHEDULE_MEMO_CHARS),
    }))).not.toThrow();

    for (const input of [
      scheduleInput({ title: "😀".repeat(MAX_SCHEDULE_TITLE_CHARS + 1) }),
      scheduleInput({ memo: "가".repeat(MAX_SCHEDULE_MEMO_CHARS + 1) }),
      scheduleInput({ title: "\ud800" }),
      scheduleInput({ memo: "\udfff" }),
    ]) {
      expect(() => parseScheduleInput(input)).toThrow(
        expect.objectContaining({ code: "validation" }),
      );
    }
  });

  it.each([
    ["scheduledOn", scheduleInput({ scheduledOn: "2026-02-30" })],
    ["scheduledOn", scheduleInput({ scheduledOn: "0000-08-06" })],
    ["scheduledOn", scheduleInput({ scheduledOn: "9999-01-01" })],
    ["scheduledTime", scheduleInput({ scheduledTime: "24:00" })],
    ["scheduledTime", scheduleInput({ scheduledTime: "9:00" })],
    ["customerId", scheduleInput({ customerId: "NOT-A-UUID" })],
    ["isCompleted", { ...scheduleInput(), isCompleted: "false" }],
    ["input", { ...scheduleInput(), rogue: "synthetic-marker" }],
  ])("rejects invalid %s input", (_field, input) => {
    expect(() => parseScheduleInput(input)).toThrow(
      expect.objectContaining({ code: "validation" }),
    );
  });

  it("validates a real half-open date range", () => {
    expect(parseScheduleQuery({
      startOn: " 2026-08-01 ",
      endBefore: " 2026-09-01 ",
    })).toEqual({ startOn: "2026-08-01", endBefore: "2026-09-01" });
    expect(() => parseScheduleQuery({
      startOn: "2026-09-01",
      endBefore: "2026-09-01",
    })).toThrow(expect.objectContaining({
      issues: expect.arrayContaining([
        expect.objectContaining({ field: "endBefore" }),
      ]),
    }));
    expect(() => parseScheduleQuery({
      startOn: "2026-02-30",
      endBefore: "2026-09-01",
    })).toThrow();
    expect(() => parseScheduleQuery({
      startOn: "0000-08-01",
      endBefore: "0000-09-01",
    })).toThrow();
    expect(parseScheduleQuery({
      startOn: "9998-12-01",
      endBefore: "9999-01-01",
    })).toEqual({ startOn: "9998-12-01", endBefore: "9999-01-01" });
  });

  it("rejects non-canonical or malformed repository responses", () => {
    for (const response of [
      { ...schedule(SCHEDULE_IDS[0]), title: " 합성 일정 " },
      { ...schedule(SCHEDULE_IDS[0]), scheduledTime: "9:00" },
      { ...schedule(SCHEDULE_IDS[0]), scheduledOn: "9999-01-01" },
      { ...schedule(SCHEDULE_IDS[0]), createdAt: "2026-08-06T01:02:03Z" },
      { ...schedule(SCHEDULE_IDS[0]), rogue: "synthetic-private-marker" },
    ]) {
      expect(() => parseSchedule(response)).toThrow(
        new ScheduleRepositoryError("일정 데이터 응답을 확인할 수 없습니다."),
      );
    }
  });
});
