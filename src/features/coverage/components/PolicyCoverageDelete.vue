<script setup lang="ts">
import type { Coverage } from "@/features/coverage/types/coverage";
import AppButton from "@/shared/components/AppButton.vue";

withDefaults(
  defineProps<{
    coverage?: Coverage | null | undefined;
    categoryName?: string;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  { coverage: null, categoryName: "보장", deleting: false, error: undefined },
);

const emit = defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <section class="coverage-delete-confirm">
    <span class="delete-symbol" aria-hidden="true">!</span>
    <div>
      <h3>{{ categoryName }} 보장을 삭제할까요?</h3>
      <p>고객 보장 합계와 이 계약의 기본 목록에서 제외됩니다.</p>
      <small>원본 행은 이 PC의 로컬 데이터베이스에 보존됩니다.</small>
    </div>
  </section>
  <p v-if="error" class="delete-error" role="alert">{{ error }}</p>
  <footer class="form-actions coverage-form-actions">
    <AppButton :disabled="deleting" autofocus @click="emit('cancel')">목록으로</AppButton>
    <AppButton variant="danger" :loading="deleting" @click="emit('confirm')">보장 삭제</AppButton>
  </footer>
</template>
