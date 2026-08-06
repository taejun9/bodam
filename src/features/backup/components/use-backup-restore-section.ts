import { nextTick, onBeforeUnmount, onMounted, ref, type Ref } from "vue";

import { backupApplication } from "@/app/composition/backup";
import type { BackupResult, BackupStatus, RestorePreview } from "../types/backup";
import { backupSafeMessage } from "../types/backup-error";

type BusyAction =
  | "directory"
  | "default"
  | "manual"
  | "restore-file"
  | "restore-discard"
  | "restore"
  | null;

export function useBackupRestoreSection(root: Ref<HTMLElement | undefined>) {
  const status = ref<BackupStatus>();
  const result = ref<BackupResult>();
  const preview = ref<RestorePreview>();
  const loading = ref(true);
  const busy = ref<BusyAction>(null);
  const error = ref<string>();
  const restoreError = ref<string>();
  const cancelled = ref(false);
  const notice = ref<string>();
  let mounted = true;

  async function focus(selector: string): Promise<void> {
    await nextTick();
    root.value?.querySelector<HTMLElement>(selector)?.focus();
  }

  async function load(focusResult = false): Promise<void> {
    let succeeded = false;
    loading.value = true;
    error.value = undefined;
    try {
      status.value = backupApplication.nativeAvailable
        ? await backupApplication.checkDaily()
        : await backupApplication.loadStatus();
      succeeded = true;
    }
    catch (loadError) { error.value = backupSafeMessage(loadError); }
    finally { loading.value = false; }
    if (!mounted || !focusResult) return;
    await focus(succeeded ? "[data-testid='backup-status']" : "[data-testid='backup-error']");
  }

  async function mutate<T>(action: Exclude<BusyAction, null>, run: () => Promise<T>): Promise<T | null> {
    if (busy.value !== null) return null;
    busy.value = action;
    error.value = undefined;
    result.value = undefined;
    cancelled.value = false;
    notice.value = undefined;
    try { return await run(); }
    catch (mutationError) {
      error.value = backupSafeMessage(mutationError);
      await focus("[data-testid='backup-error']");
      return null;
    } finally { busy.value = null; }
  }

  async function chooseDirectory(): Promise<void> {
    const value = await mutate("directory", () => backupApplication.chooseDirectory());
    if (value) {
      status.value = value;
      notice.value = "백업 폴더를 변경했습니다.";
      await focus("[data-testid='backup-status']");
    }
    else if (!error.value) { cancelled.value = true; await focus("[data-testid='choose-backup-directory']"); }
  }

  async function useDefault(): Promise<void> {
    const value = await mutate("default", () => backupApplication.useDefaultDirectory());
    if (value) {
      status.value = value;
      notice.value = "앱 기본 백업 폴더로 변경했습니다.";
      await focus("[data-testid='backup-status']");
    }
  }

  async function createManual(): Promise<void> {
    const value = await mutate("manual", () => backupApplication.createManual());
    if (!value) return;
    result.value = value;
    await load();
    await focus("[data-testid='backup-result']");
  }

  async function chooseRestore(): Promise<void> {
    const value = await mutate("restore-file", () => backupApplication.chooseRestore());
    if (value) preview.value = value;
    else if (!error.value) { cancelled.value = true; await focus("[data-testid='choose-restore']"); }
  }

  async function closeRestore(): Promise<void> {
    if (busy.value !== null || !preview.value) return;
    const token = preview.value.token;
    busy.value = "restore-discard";
    restoreError.value = undefined;
    try {
      await backupApplication.discardRestore(token);
      if (mounted) preview.value = undefined;
    } catch (discardFailure) {
      if (mounted) restoreError.value = backupSafeMessage(discardFailure);
    } finally {
      if (mounted) busy.value = null;
    }
  }

  async function confirmRestore(): Promise<void> {
    if (!preview.value || busy.value !== null) return;
    busy.value = "restore";
    restoreError.value = undefined;
    try {
      await backupApplication.prepareRestore(preview.value.token);
      await nextTick();
      await backupApplication.restartForRestore();
    } catch (restoreFailure) {
      restoreError.value = backupSafeMessage(restoreFailure);
    } finally { if (mounted) busy.value = null; }
  }

  onMounted(() => { void load(); });
  onBeforeUnmount(() => {
    mounted = false;
    if (preview.value) {
      void backupApplication.discardRestore(preview.value.token).catch(() => undefined);
    }
    backupApplication.clear();
  });

  return {
    nativeAvailable: backupApplication.nativeAvailable,
    status, result, preview, loading, busy, error, restoreError, cancelled, notice,
    load, chooseDirectory, useDefault, createManual, chooseRestore, closeRestore, confirmRestore,
  };
}
