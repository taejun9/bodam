export type BackupReason = "daily" | "exit" | "manual" | "pre_restore";
export type BackupLocationKind = "default" | "custom";

export interface BackupLocation {
  readonly kind: BackupLocationKind;
  readonly basename: string | null;
  readonly available: boolean;
}

export interface RestoreStartupStatus {
  readonly outcome: "restored" | "rolled_back";
  readonly message: string;
}

export interface BackupStatus {
  readonly available: boolean;
  readonly location: BackupLocation;
  readonly lastSuccessfulAt: string | null;
  readonly automaticCount: number;
  readonly maxAutomaticCount: 30;
  readonly lastFailure: string | null;
  readonly restoreStartup: RestoreStartupStatus | null;
  readonly exitFailurePending: boolean;
}

export interface BackupResult {
  readonly basename: string;
  readonly createdAt: string;
  readonly reason: BackupReason;
  readonly retentionWarning: boolean;
}

export interface RestorePreview {
  readonly token: string;
  readonly basename: string;
  readonly createdAt: string;
  readonly appVersion: string;
  readonly schemaVersion: string;
  readonly reason: BackupReason;
}

export interface RestorePrepared {
  readonly restartRequired: true;
  readonly safetyBackupBasename: string;
}
