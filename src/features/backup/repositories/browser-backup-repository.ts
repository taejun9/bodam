import type { BackupRepository } from "./backup-repository";
import type {
  BackupResult,
  BackupStatus,
  RestorePrepared,
  RestorePreview,
} from "../types/backup";
import { BackupRepositoryError } from "../types/backup-error";

const unavailableStatus: BackupStatus = {
  available: false,
  location: { kind: "default", basename: null, available: false },
  lastSuccessfulAt: null,
  automaticCount: 0,
  maxAutomaticCount: 30,
  lastFailure: null,
  restoreStartup: null,
  exitFailurePending: false,
};

export class BrowserBackupRepository implements BackupRepository {
  readonly nativeAvailable = false;

  async loadStatus(): Promise<BackupStatus> { return unavailableStatus; }
  async acknowledgeRestoreStartup(): Promise<void> { return Promise.resolve(); }
  async chooseDirectory(): Promise<BackupStatus | null> { throw unavailable(); }
  async useDefaultDirectory(): Promise<BackupStatus> { throw unavailable(); }
  async createManual(): Promise<BackupResult> { throw unavailable(); }
  async chooseRestore(): Promise<RestorePreview | null> { throw unavailable(); }
  async discardRestore(): Promise<void> { return Promise.resolve(); }
  async prepareRestore(): Promise<RestorePrepared> { throw unavailable(); }
  async restartForRestore(): Promise<void> { throw unavailable(); }
  async checkDaily(): Promise<BackupStatus> { return unavailableStatus; }
  async retryExit(): Promise<void> { throw unavailable(); }
  async exitWithoutBackup(): Promise<void> { throw unavailable(); }
}

function unavailable(): BackupRepositoryError {
  return new BackupRepositoryError(
    "백업과 복원은 설치된 데스크톱 앱에서만 사용할 수 있습니다.",
    "native_unavailable",
  );
}
