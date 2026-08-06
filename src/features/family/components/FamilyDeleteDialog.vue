<script setup lang="ts">
import type { FamilySummary } from "@/features/family/types/family";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

withDefaults(
  defineProps<{
    open: boolean;
    family?: FamilySummary | null | undefined;
    familyLabel?: string | undefined;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  {
    family: null,
    familyLabel: undefined,
    deleting: false,
    error: undefined,
  },
);
const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <AppDialog
    :open="open"
    title="가족을 기본 목록에서 삭제할까요?"
    size="small"
    @close="emit('close')"
  >
    <section class="family-delete-content">
      <span class="family-delete-symbol" aria-hidden="true">!</span>
      <div>
        <h3>{{ familyLabel ?? family?.family.name }}</h3>
        <p>활성 구성원 {{ family?.memberCount ?? 0 }}명과 가족 보험료 합계가 기본 목록에서 숨겨집니다.</p>
        <small>구성원 연결 기록과 고객·보험계약은 수정하거나 삭제하지 않고 이 PC에 보존합니다.</small>
      </div>
    </section>
    <p v-if="error" class="form-submit-error" role="alert">{{ error }}</p>
    <footer class="form-actions family-dialog-actions">
      <AppButton :disabled="deleting" autofocus @click="emit('close')">취소</AppButton>
      <AppButton
        variant="danger"
        data-testid="confirm-delete-family"
        :loading="deleting"
        @click="emit('confirm')"
      >
        가족 삭제
      </AppButton>
    </footer>
  </AppDialog>
</template>
