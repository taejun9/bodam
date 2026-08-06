<script setup lang="ts">
import type { Customer } from "@/features/customer/types/customer";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

withDefaults(
  defineProps<{
    open: boolean;
    customer?: Customer | null | undefined;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  {
    customer: null,
    deleting: false,
    error: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();
</script>

<template>
  <AppDialog
    :open="open"
    title="고객을 목록에서 제외할까요?"
    size="small"
    @close="emit('close')"
  >
    <div class="delete-content">
      <span class="delete-symbol" aria-hidden="true">!</span>
      <div>
        <p>
          <strong>{{ customer?.name }}</strong> 고객이 기본 목록에서 보이지 않게 됩니다.
        </p>
        <small>
          보험계약과 가족 구성원 연결은 보존되지만, 가족 구성원 목록과 보험료 합계에서는 숨겨집니다.
        </small>
      </div>
    </div>
    <p v-if="error" class="delete-error" role="alert">{{ error }}</p>
    <footer class="form-actions delete-actions">
      <AppButton :disabled="deleting" autofocus @click="emit('close')">
        취소
      </AppButton>
      <AppButton variant="danger" :loading="deleting" @click="emit('confirm')">
        목록에서 제외
      </AppButton>
    </footer>
  </AppDialog>
</template>

<style scoped>
.delete-content {
  display: flex;
  align-items: flex-start;
  gap: 14px;
}

.delete-symbol {
  display: grid;
  width: 36px;
  height: 36px;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 50%;
  flex: 0 0 auto;
  font-weight: 800;
  place-items: center;
}

.delete-content p {
  margin: 1px 0 6px;
}

.delete-content small {
  color: var(--text-muted);
}

.delete-error {
  margin: 16px 0 0;
  padding: 10px 12px;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: var(--radius-sm);
  font-size: 12px;
}

.delete-actions {
  margin: 24px -24px -24px;
  padding: 16px 24px;
  background: var(--bg-subtle);
  border-top: 1px solid var(--border);
}
</style>
