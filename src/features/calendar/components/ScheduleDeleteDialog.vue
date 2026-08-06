<script setup lang="ts">
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

withDefaults(
  defineProps<{
    open: boolean;
    title?: string | undefined;
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  { title: "", deleting: false, error: undefined },
);

const emit = defineEmits<{ close: []; confirm: [] }>();
</script>

<template>
  <AppDialog
    :open="open"
    title="일정 삭제"
    description="원본은 이 PC에 보존되고 기본 달력에서는 숨겨집니다."
    size="small"
    @close="emit('close')"
  >
    <div class="schedule-delete-copy">
      <p>이 일정을 기본 달력에서 삭제할까요?</p>
      <strong v-if="title">{{ title }}</strong>
      <p v-if="error" class="form-submit-error" role="alert">{{ error }}</p>
    </div>
    <footer class="form-actions">
      <AppButton autofocus :disabled="deleting" @click="emit('close')">취소</AppButton>
      <AppButton variant="danger" :loading="deleting" @click="emit('confirm')">
        일정 삭제
      </AppButton>
    </footer>
  </AppDialog>
</template>
