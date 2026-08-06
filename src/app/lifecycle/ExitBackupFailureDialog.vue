<script setup lang="ts">
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

defineProps<{
  open: boolean;
  busy: boolean;
  error?: string | undefined;
}>();

const emit = defineEmits<{ retry: []; exit: [] }>();
</script>

<template>
  <AppDialog
    :open="open"
    title="종료 전 백업을 만들지 못했습니다"
    description="현재 데이터는 그대로입니다. 다시 시도하거나 경고를 확인한 뒤 백업 없이 종료할 수 있습니다."
    size="small"
    :busy="busy"
    dismiss-disabled
  >
    <div class="exit-backup-dialog">
      <p>
        백업 없이 종료하면 마지막 성공 백업 이후 변경 내용은 별도 복구 파일에 남지 않습니다.
      </p>
      <p v-if="error" role="alert">{{ error }}</p>
      <footer>
        <AppButton autofocus :loading="busy" @click="emit('retry')">
          {{ busy ? "백업을 다시 만드는 중" : "백업 다시 시도" }}
        </AppButton>
        <AppButton variant="danger" :disabled="busy" @click="emit('exit')">
          백업 없이 종료
        </AppButton>
      </footer>
    </div>
  </AppDialog>
</template>

<style scoped>
.exit-backup-dialog { display: grid; gap: 14px; }
.exit-backup-dialog p { margin: 0; color: var(--text-secondary); font-size: 11px; }
.exit-backup-dialog p[role="alert"] { color: var(--danger); }
.exit-backup-dialog footer { display: flex; justify-content: flex-end; gap: 8px; }
@media (max-width: 420px) {
  .exit-backup-dialog footer { display: grid; grid-template-columns: 1fr; }
}
</style>
