<script setup lang="ts">
import type { RestorePreview } from "../types/backup";
import { backupReasonLabel, backupTimestampLabel } from "./backup-display";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

defineProps<{
  open: boolean;
  preview?: RestorePreview | undefined;
  restoring: boolean;
  discarding: boolean;
  error?: string | undefined;
}>();

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <AppDialog
    :open="open"
    title="백업에서 복원"
    description="현재 데이터의 안전 사본을 만든 뒤 선택한 시점으로 교체하고 앱을 다시 시작합니다."
    size="small"
    :busy="restoring || discarding"
    :dismiss-disabled="restoring || discarding"
    @close="emit('close')"
  >
    <div v-if="preview" class="restore-confirm-content">
      <dl class="restore-summary">
        <div><dt>백업 파일</dt><dd>{{ preview.basename }}</dd></div>
        <div><dt>생성 시각</dt><dd>{{ backupTimestampLabel(preview.createdAt) }}</dd></div>
        <div><dt>종류</dt><dd>{{ backupReasonLabel(preview.reason) }}</dd></div>
        <div><dt>버전</dt><dd>{{ preview.appVersion }} · {{ preview.schemaVersion }}</dd></div>
      </dl>
      <p class="restore-warning">
        복원 중에는 앱을 닫지 마세요. 검증 또는 교체가 실패하면 현재 데이터로 되돌립니다.
      </p>
      <p v-if="error" class="dialog-error" role="alert">{{ error }}</p>
      <footer class="dialog-actions">
        <AppButton
          autofocus
          :disabled="restoring"
          :loading="discarding"
          @click="emit('close')"
        >{{ discarding ? "선택을 취소하는 중" : "취소" }}</AppButton>
        <AppButton
          variant="danger"
          :disabled="discarding"
          :loading="restoring"
          @click="emit('confirm')"
        >{{ restoring ? "안전 사본을 만드는 중" : "복원하고 다시 시작" }}</AppButton>
      </footer>
    </div>
  </AppDialog>
</template>

<style scoped>
.restore-confirm-content { display: grid; gap: 16px; }
.restore-summary { display: grid; margin: 0; gap: 8px; }
.restore-summary div {
  display: grid;
  min-width: 0;
  padding: 9px 11px;
  background: var(--bg-subtle);
  border-radius: 7px;
  grid-template-columns: 82px minmax(0, 1fr);
  gap: 8px;
}
.restore-summary dt { color: var(--text-secondary); font-size: 10px; }
.restore-summary dd { margin: 0; overflow-wrap: anywhere; font-size: 11px; }
.restore-warning { margin: 0; color: var(--warning); font-size: 11px; }
.dialog-error { margin: 0; color: var(--danger); font-size: 11px; }
.dialog-actions { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 420px) {
  .restore-summary div { grid-template-columns: 1fr; }
  .dialog-actions { display: grid; grid-template-columns: 1fr; }
}
</style>
