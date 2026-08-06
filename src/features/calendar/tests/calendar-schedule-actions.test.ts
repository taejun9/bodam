import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Schedule, ScheduleInput } from "@/features/schedule/types/schedule";
import { ScheduleValidationError } from "@/features/schedule/types/schedule-error";

import { calendarUiSchedule } from "./calendar-ui-test-data";

const applicationMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  setCompleted: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/app/composition/schedule", () => ({
  scheduleApplication: applicationMocks,
}));

import { useCalendarScheduleActions } from "../composables/use-calendar-schedule-actions";

const timestamp = "2026-08-06T00:00:00.000Z";
const input: ScheduleInput = {
  title: "합성 일정",
  scheduledOn: "2026-08-07",
  scheduledTime: "09:30",
  memo: "합성 메모",
  customerId: null,
  isCompleted: false,
};

function stored(overrides: Partial<Schedule> = {}): Schedule {
  return {
    id: calendarUiSchedule.id,
    ...input,
    createdAt: timestamp,
    updatedAt: timestamp,
    ...overrides,
  };
}

function harness(selectedDate = "2026-08-06") {
  const options = {
    selectedDate: vi.fn(() => selectedDate),
    selectDate: vi.fn().mockResolvedValue(undefined),
    reload: vi.fn().mockResolvedValue(undefined),
    showNotice: vi.fn(),
  };
  return { actions: useCalendarScheduleActions(options), options };
}

describe("calendar schedule actions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("creates a schedule, moves to its date, reloads, and closes the form", async () => {
    applicationMocks.create.mockResolvedValue(stored());
    const { actions, options } = harness();
    actions.createSchedule();

    expect(actions.formOpen.value).toBe(true);
    expect(actions.selectedSchedule.value).toBeUndefined();
    await actions.saveSchedule(input);

    expect(applicationMocks.create).toHaveBeenCalledWith(input);
    expect(options.selectDate).toHaveBeenCalledWith("2026-08-07");
    expect(options.reload).toHaveBeenCalledTimes(1);
    expect(options.showNotice).toHaveBeenCalledWith("새 일정을 저장했습니다.");
    expect(actions.formOpen.value).toBe(false);
    expect(actions.submitting.value).toBe(false);
  });

  it("updates an existing schedule without changing the selected date", async () => {
    const editingInput = { ...input, scheduledOn: "2026-08-06" };
    applicationMocks.update.mockResolvedValue(stored(editingInput));
    const { actions, options } = harness();
    actions.editSchedule(calendarUiSchedule);

    expect(actions.selectedSchedule.value).toEqual(calendarUiSchedule);
    await actions.saveSchedule(editingInput);

    expect(applicationMocks.update).toHaveBeenCalledWith(
      calendarUiSchedule.id,
      editingInput,
    );
    expect(options.selectDate).not.toHaveBeenCalled();
    expect(options.reload).toHaveBeenCalledTimes(1);
    expect(options.showNotice).toHaveBeenCalledWith("일정을 저장했습니다.");
  });

  it("maps strict field errors and replaces unexpected failures with a safe message", async () => {
    applicationMocks.create.mockRejectedValueOnce(new ScheduleValidationError([
      { field: "title", message: "일정 제목을 입력해 주세요." },
      { field: "unknown", message: "unmapped-private-marker" },
    ]));
    const { actions } = harness();
    actions.createSchedule();
    await actions.saveSchedule(input);

    expect(actions.formErrors.value).toEqual({
      title: "일정 제목을 입력해 주세요.",
    });
    expect(actions.formSubmitError.value).toBeUndefined();
    expect(actions.formOpen.value).toBe(true);
    actions.clearFormError("title");
    expect(actions.formErrors.value).toEqual({});

    applicationMocks.create.mockRejectedValueOnce(
      new Error("private-schedule-write-marker"),
    );
    await actions.saveSchedule(input);
    expect(actions.formSubmitError.value).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(actions.formSubmitError.value).not.toContain("private-schedule-write-marker");
  });

  it("toggles completion, reloads, and keeps the action available", async () => {
    applicationMocks.setCompleted.mockResolvedValue(stored({ isCompleted: true }));
    const { actions, options } = harness();

    const operation = actions.setCompleted(calendarUiSchedule, false);
    expect(actions.completingId.value).toBe(calendarUiSchedule.id);
    await operation;

    expect(applicationMocks.setCompleted).toHaveBeenCalledWith(
      calendarUiSchedule.id,
      false,
    );
    expect(options.reload).toHaveBeenCalledTimes(1);
    expect(options.showNotice).toHaveBeenCalledWith("일정 완료를 되돌렸습니다.");
    expect(actions.completingId.value).toBeUndefined();
  });

  it("confirms soft deletion through the application and reloads the calendar", async () => {
    applicationMocks.remove.mockResolvedValue(undefined);
    const { actions, options } = harness();
    actions.requestDelete(calendarUiSchedule);

    expect(actions.deleteOpen.value).toBe(true);
    expect(actions.deletingSchedule.value).toEqual(calendarUiSchedule);
    await actions.confirmDelete();

    expect(applicationMocks.remove).toHaveBeenCalledWith(calendarUiSchedule.id);
    expect(actions.deleteOpen.value).toBe(false);
    expect(actions.deleting.value).toBe(false);
    expect(options.reload).toHaveBeenCalledTimes(1);
    expect(options.showNotice).toHaveBeenCalledWith(
      "일정을 기본 달력에서 삭제했습니다.",
    );
  });
});
