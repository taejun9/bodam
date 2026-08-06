import { BackupApplication } from "@/features/backup/application/backup-application";
import { createBackupRepository } from "@/features/backup/repositories/backup-repository-factory";

export const backupApplication = new BackupApplication(createBackupRepository());
