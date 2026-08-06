<script setup lang="ts">
import type { FamilyMemberView } from "@/features/family/types/family";
import AppButton from "@/shared/components/AppButton.vue";

withDefaults(
  defineProps<{
    member?: FamilyMemberView | null | undefined;
    customerLabel?: string | undefined;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  { member: null, customerLabel: undefined, deleting: false, error: undefined },
);
const emit = defineEmits<{ cancel: []; confirm: [] }>();
</script>

<template>
  <section data-testid="family-member-delete">
    <div class="family-delete-content">
      <span class="family-delete-symbol" aria-hidden="true">!</span>
      <div>
        <h3>{{ customerLabel ?? member?.customerName }}</h3>
        <p>이 가족에서 구성원 연결을 삭제하면 활성 구성원 수와 월보험료 합계에서 빠집니다.</p>
        <small>고객과 보험계약 원본은 보존되며, 필요한 경우 이 가족에 다시 추가할 수 있습니다.</small>
      </div>
    </div>
    <p v-if="error" class="form-submit-error" role="alert">{{ error }}</p>
    <footer class="form-actions family-dialog-actions">
      <AppButton :disabled="deleting" autofocus @click="emit('cancel')">취소</AppButton>
      <AppButton variant="danger" :loading="deleting" @click="emit('confirm')">
        연결 삭제
      </AppButton>
    </footer>
  </section>
</template>
