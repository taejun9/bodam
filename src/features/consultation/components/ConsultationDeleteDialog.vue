<script setup lang="ts">
import { computed } from "vue";

import { formatConsultedAtLocal } from "@/features/consultation/services/consultation-datetime";
import type { Consultation } from "@/features/consultation/types/consultation";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    consultation?: Consultation | null | undefined;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  {
    consultation: null,
    deleting: false,
    error: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  confirm: [];
}>();

const consultedAtLabel = computed(() =>
  props.consultation
    ? formatConsultedAtLocal(props.consultation.consultedAt)
    : "선택한 상담",
);
</script>

<template>
  <AppDialog :open="open" title="상담 기록을 삭제할까요?" size="small" @close="emit('close')">
    <div class="consultation-delete-content">
      <span class="consultation-delete-symbol" aria-hidden="true">!</span>
      <div>
        <p><strong>{{ consultedAtLabel }}</strong> 상담이 기본 목록에서 제외됩니다.</p>
        <small>상담 원본 행은 이 PC의 로컬 데이터베이스에 보존됩니다.</small>
      </div>
    </div>
    <p v-if="error" class="consultation-delete-error" role="alert">{{ error }}</p>
    <footer class="form-actions consultation-delete-actions">
      <AppButton :disabled="deleting" autofocus @click="emit('close')">취소</AppButton>
      <AppButton
        variant="danger"
        :loading="deleting"
        data-testid="confirm-delete-consultation"
        @click="emit('confirm')"
      >상담 삭제</AppButton>
    </footer>
  </AppDialog>
</template>
