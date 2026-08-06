import type { BackupRepository } from "../repositories/backup-repository";
import {
  backupResultSchema,
  backupStatusSchema,
  restorePreparedSchema,
  restorePreviewSchema,
} from "../schemas/backup-schema";
import type {
  BackupStatus,
} from "../types/backup";
import { BackupApplicationError, BackupError } from "../types/backup-error";

export class BackupApplication {
  private sequence = 0;
  private mutation = false;
  private mutationBarrier: Promise<void> | undefined;
  private dailyCheck: Promise<BackupStatus> | undefined;
  readonly nativeAvailable: boolean;

  constructor(private readonly repository: BackupRepository) {
    this.nativeAvailable = repository.nativeAvailable;
  }

  loadStatus = () => this.operation((value) => backupStatusSchema.parse(value),
    () => this.repository.loadStatus());
  async acknowledgeRestoreStartup(): Promise<void> {
    try { await this.repository.acknowledgeRestoreStartup(); }
    catch (error: unknown) { throw safe(error); }
  }
  chooseDirectory = () => this.mutateNullable((value) => backupStatusSchema.parse(value),
    () => this.repository.chooseDirectory());
  useDefaultDirectory = () => this.mutate((value) => backupStatusSchema.parse(value),
    () => this.repository.useDefaultDirectory());
  createManual = () => this.mutate((value) => backupResultSchema.parse(value),
    () => this.repository.createManual());
  chooseRestore = () => this.mutateNullable((value) => restorePreviewSchema.parse(value),
    () => this.repository.chooseRestore());
  prepareRestore = (token: string) => this.mutate((value) => restorePreparedSchema.parse(value),
    () => this.repository.prepareRestore(token));

  async discardRestore(token: string): Promise<void> {
    this.sequence += 1;
    await this.mutateNullable(
      () => undefined,
      async () => { await this.repository.discardRestore(token); },
    );
  }

  async restartForRestore(): Promise<void> { await this.repository.restartForRestore(); }
  async checkDaily(): Promise<BackupStatus> {
    if (!this.dailyCheck) {
      const barrier = this.mutationBarrier;
      const operation = barrier
        ? barrier.then(() => this.repository.checkDaily())
        : this.repository.checkDaily();
      this.dailyCheck = operation
        .then((value) => backupStatusSchema.parse(value))
        .catch((error: unknown) => { throw safe(error); })
        .finally(() => { this.dailyCheck = undefined; });
    }
    return this.dailyCheck;
  }
  async retryExit(): Promise<void> { await this.repository.retryExit(); }
  async exitWithoutBackup(): Promise<void> { await this.repository.exitWithoutBackup(); }
  clear(): void { this.sequence += 1; }

  private async operation<T>(parse: (value: unknown) => T, run: () => Promise<unknown>): Promise<T> {
    const operation = ++this.sequence;
    try {
      const value = parse(await run());
      if (operation !== this.sequence) throw stale();
      return value;
    } catch (error: unknown) { throw safe(error); }
  }

  private async mutate<T>(parse: (value: unknown) => T, run: () => Promise<unknown>): Promise<T> {
    const value = await this.mutateNullable(parse, run);
    if (value === null) throw new BackupApplicationError("백업 작업이 취소되었습니다.");
    return value;
  }

  private async mutateNullable<T>(
    parse: (value: unknown) => T,
    run: () => Promise<unknown>,
  ): Promise<T | null> {
    if (this.mutation) throw new BackupApplicationError("다른 백업 작업이 진행 중입니다.", "busy");
    this.mutation = true;
    let releaseBarrier!: () => void;
    const barrier = new Promise<void>((resolve) => { releaseBarrier = resolve; });
    this.mutationBarrier = barrier;
    const dailyCheck = this.dailyCheck;
    try {
      await dailyCheck?.catch(() => undefined);
      const value = await run();
      return value === null ? null : parse(value);
    } catch (error: unknown) { throw safe(error); }
    finally {
      this.mutation = false;
      if (this.mutationBarrier === barrier) this.mutationBarrier = undefined;
      releaseBarrier();
    }
  }
}

function safe(error: unknown): BackupError {
  return error instanceof BackupError ? error : new BackupApplicationError();
}

function stale(): BackupApplicationError {
  return new BackupApplicationError("화면 상태가 바뀌었습니다. 다시 시도해 주세요.");
}
