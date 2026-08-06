const safeMessage = "캘린더를 불러오지 못했습니다. 다시 시도해 주세요.";

export class CalendarApplicationError extends Error {
  constructor() {
    super(safeMessage);
    this.name = "CalendarApplicationError";
  }
}

export function calendarSafeMessage(error: unknown): string {
  void error;
  return safeMessage;
}
