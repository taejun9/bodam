const safeMessage = "대시보드를 불러오지 못했습니다. 다시 시도해 주세요.";

export class DashboardApplicationError extends Error {
  constructor() {
    super(safeMessage);
    this.name = "DashboardApplicationError";
  }
}

export function dashboardSafeMessage(error: unknown): string {
  void error;
  return safeMessage;
}
