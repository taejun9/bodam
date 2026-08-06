<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, useRoute } from "vue-router";

import { backupApplication } from "@/app/composition/backup";
import { millisecondsUntilNextLocalMidnight } from "@/shared/calendar-runtime";
import type { BackupStatus } from "@/features/backup/types/backup";
import { BackupError, backupSafeMessage } from "@/features/backup/types/backup-error";
import ExitBackupFailureDialog from "./ExitBackupFailureDialog.vue";

const exitDialogOpen = ref(false);
const route = useRoute();
const exitBusy = ref(false);
const exitError = ref<string>();
const lifecycleNotice = ref<string>();
let unlisten: (() => void) | undefined;
let midnightTimer: ReturnType<typeof setTimeout> | undefined;
let hidden = document.visibilityState === "hidden";
let statusRecovered = false;
let recoveryInFlight: Promise<boolean> | undefined;
let restoreNoticeActive = false;

function showLifecycleFailure(error: unknown): void {
  if (!restoreNoticeActive) lifecycleNotice.value = backupSafeMessage(error);
}

function dismissNotice(): void {
  lifecycleNotice.value = undefined;
  restoreNoticeActive = false;
}

function applyStatus(status: BackupStatus, announceStartupEverywhere = false): void {
  if (status.exitFailurePending) {
    exitError.value = undefined;
    exitDialogOpen.value = true;
  }
  if (status.restoreStartup && (announceStartupEverywhere || route.path !== "/settings")) {
    restoreNoticeActive = true;
    lifecycleNotice.value = status.restoreStartup.message;
    return;
  }
  if (status.exitFailurePending) return;
  if (!lifecycleNotice.value && status.lastFailure && route.path !== "/settings") {
    lifecycleNotice.value = status.lastFailure;
  }
}

async function runStatusRecovery(): Promise<boolean> {
  try {
    const status = await backupApplication.loadStatus();
    applyStatus(status, true);
    if (status.restoreStartup) {
      await nextTick();
      await backupApplication.acknowledgeRestoreStartup();
    }
    statusRecovered = true;
    return true;
  } catch (error: unknown) {
    if (!(error instanceof BackupError && error.code === "busy")) {
      showLifecycleFailure(error);
    }
    return false;
  }
}

function recoverInitialStatus(): Promise<boolean> {
  if (statusRecovered) return Promise.resolve(true);
  if (!recoveryInFlight) {
    recoveryInFlight = runStatusRecovery().finally(() => { recoveryInFlight = undefined; });
  }
  return recoveryInFlight;
}

async function checkDaily(): Promise<void> {
  if (!backupApplication.nativeAvailable) return;
  try {
    applyStatus(await backupApplication.checkDaily());
  } catch (error: unknown) {
    if (!(error instanceof BackupError && error.code === "busy")) {
      showLifecycleFailure(error);
    }
  }
}

function scheduleMidnight(): void {
  if (midnightTimer) clearTimeout(midnightTimer);
  midnightTimer = setTimeout(() => {
    scheduleMidnight();
    void checkDaily();
  }, millisecondsUntilNextLocalMidnight());
}

async function refreshAfterFocus(): Promise<void> {
  if (!statusRecovered) await recoverInitialStatus();
  await checkDaily();
}

function handleFocus(): void {
  scheduleMidnight();
  void refreshAfterFocus();
}

function handleVisibility(): void {
  if (document.visibilityState === "hidden") { hidden = true; return; }
  if (!hidden) return;
  hidden = false;
  handleFocus();
}

async function retryExit(): Promise<void> {
  if (exitBusy.value) return;
  exitBusy.value = true;
  exitError.value = undefined;
  try { await backupApplication.retryExit(); }
  catch (error: unknown) { exitError.value = backupSafeMessage(error); }
  finally { exitBusy.value = false; }
}

async function exitWithoutBackup(): Promise<void> {
  if (exitBusy.value) return;
  exitBusy.value = true;
  try { await backupApplication.exitWithoutBackup(); }
  catch (error: unknown) { exitError.value = backupSafeMessage(error); exitBusy.value = false; }
}

onMounted(async () => {
  if (!backupApplication.nativeAvailable) return;
  const { listen } = await import("@tauri-apps/api/event");
  unlisten = await listen("bodam://exit-backup-failed", () => {
    exitError.value = undefined;
    exitDialogOpen.value = true;
  });
  document.addEventListener("visibilitychange", handleVisibility);
  window.addEventListener("focus", handleFocus);
  scheduleMidnight();
  const recovered = await recoverInitialStatus();
  await checkDaily();
  if (!recovered) await recoverInitialStatus();
});

onBeforeUnmount(() => {
  unlisten?.();
  document.removeEventListener("visibilitychange", handleVisibility);
  window.removeEventListener("focus", handleFocus);
  if (midnightTimer) clearTimeout(midnightTimer);
});
</script>

<template>
  <Teleport to="body">
    <aside v-if="lifecycleNotice" class="backup-lifecycle-notice" role="status">
      <span>{{ lifecycleNotice }}</span>
      <RouterLink to="/settings">백업 설정</RouterLink>
      <button type="button" aria-label="백업 알림 닫기" @click="dismissNotice">×</button>
    </aside>
  </Teleport>
  <ExitBackupFailureDialog
    :open="exitDialogOpen"
    :busy="exitBusy"
    :error="exitError"
    @retry="retryExit"
    @exit="exitWithoutBackup"
  />
</template>

<style scoped>
.backup-lifecycle-notice {
  position: fixed;
  z-index: 20;
  right: 18px;
  bottom: 18px;
  display: flex;
  max-width: min(460px, calc(100vw - 32px));
  padding: 11px 13px;
  color: var(--warning);
  background: var(--warning-bg);
  border: 1px solid color-mix(in srgb, var(--warning) 28%, transparent);
  border-radius: 9px;
  box-shadow: var(--shadow-lg);
  align-items: center;
  gap: 10px;
  font-size: 11px;
}
.backup-lifecycle-notice span { min-width: 0; overflow-wrap: anywhere; }
.backup-lifecycle-notice a { color: inherit; white-space: nowrap; font-weight: 700; }
.backup-lifecycle-notice button { color: inherit; background: transparent; font-size: 18px; }
@media (max-width: 520px) {
  .backup-lifecycle-notice { right: 12px; bottom: 12px; left: 12px; }
}
</style>
