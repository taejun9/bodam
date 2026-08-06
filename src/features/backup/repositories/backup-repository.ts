import type {
  BackupResult,
  BackupStatus,
  RestorePrepared,
  RestorePreview,
} from "../types/backup";

export interface BackupRepository {
  readonly nativeAvailable: boolean;
  loadStatus(): Promise<BackupStatus>;
  acknowledgeRestoreStartup(): Promise<void>;
  chooseDirectory(): Promise<BackupStatus | null>;
  useDefaultDirectory(): Promise<BackupStatus>;
  createManual(): Promise<BackupResult>;
  chooseRestore(): Promise<RestorePreview | null>;
  discardRestore(token: string): Promise<void>;
  prepareRestore(token: string): Promise<RestorePrepared>;
  restartForRestore(): Promise<void>;
  checkDaily(): Promise<BackupStatus>;
  retryExit(): Promise<void>;
  exitWithoutBackup(): Promise<void>;
}
