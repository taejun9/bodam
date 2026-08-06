import { BrowserBackupRepository } from "./browser-backup-repository";
import type { BackupRepository } from "./backup-repository";
import { TauriBackupRepository } from "./tauri-backup-repository";

export const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createBackupRepository = (): BackupRepository =>
  isTauriRuntime() ? new TauriBackupRepository() : new BrowserBackupRepository();
