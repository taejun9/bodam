import { describe, expect, it } from "vitest";

import {
  ScheduleRepositoryError,
  ScheduleValidationError,
  scheduleSafeMessage,
} from "../types/schedule-error";

describe("scheduleSafeMessage", () => {
  it("preserves allowlisted schedule messages", () => {
    expect(scheduleSafeMessage(
      new ScheduleRepositoryError("일정을 찾을 수 없습니다.", "not_found"),
    )).toBe("일정을 찾을 수 없습니다.");
    expect(scheduleSafeMessage(
      new ScheduleValidationError([
        { field: "title", message: "일정 제목을 입력해 주세요." },
      ]),
    )).toBe("입력 내용을 확인해 주세요.");
  });

  it("redacts unexpected details", () => {
    expect(scheduleSafeMessage(
      new Error("sqlite failed for Synthetic Private Value"),
    )).toBe("작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.");
  });
});
