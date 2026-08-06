import type { BackupLocation, BackupReason } from "../types/backup";

export function backupLocationLabel(location: BackupLocation): string {
  if (location.kind === "default") return "앱 기본 백업 폴더";
  return location.basename === null ? "사용자 지정 폴더" : `사용자 지정 · ${location.basename}`;
}

export function backupReasonLabel(reason: BackupReason): string {
  return {
    daily: "하루 1회 자동 백업",
    exit: "종료 시 변경 백업",
    manual: "수동 백업",
    pre_restore: "복원 전 안전 사본",
  }[reason];
}

export function backupTimestampLabel(value: string | null): string {
  if (value === null) return "아직 없음";
  return new Intl.DateTimeFormat("ko-KR", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}
