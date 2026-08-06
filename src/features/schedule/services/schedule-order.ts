import type { Schedule } from "../types/schedule";

function compareCodeUnits(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function compareTimes(left: string | null, right: string | null): number {
  if (left === null && right !== null) return -1;
  if (left !== null && right === null) return 1;
  return compareCodeUnits(left ?? "", right ?? "");
}

export function sortSchedules(schedules: readonly Schedule[]): Schedule[] {
  return [...schedules].sort((left, right) =>
    compareCodeUnits(left.scheduledOn, right.scheduledOn) ||
    compareTimes(left.scheduledTime, right.scheduledTime) ||
    compareCodeUnits(left.title, right.title) ||
    compareCodeUnits(left.id, right.id)
  );
}
