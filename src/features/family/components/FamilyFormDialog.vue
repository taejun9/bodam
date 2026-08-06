<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import type { FamilySummary } from "@/features/family/types/family";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

type FamilyNameErrors = { readonly name?: string };

const props = withDefaults(
  defineProps<{
    open: boolean;
    family?: FamilySummary | null | undefined;
    familyLabel?: string | undefined;
    submitting?: boolean;
    errors?: FamilyNameErrors;
    submitError?: string | undefined;
  }>(),
  {
    family: null,
    familyLabel: undefined,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);
const emit = defineEmits<{ close: []; submit: [input: { name: string }] }>();

const nameInput = ref<HTMLInputElement>();
const name = ref("");
const localError = ref<string>();
const isEditing = computed(() => props.family !== null);
const nameError = computed(() => localError.value ?? props.errors.name);

function reset() {
  name.value = props.family?.family.name ?? "";
  localError.value = undefined;
}

function focusError() {
  void nextTick(() => nameInput.value?.focus());
}

function submit() {
  const normalized = name.value.trim();
  if (!normalized) localError.value = "가족 이름을 입력해 주세요.";
  else if (Array.from(normalized).length > 100) {
    localError.value = "가족 이름은 100자 이내로 입력해 주세요.";
  }
  if (localError.value) return focusError();
  emit("submit", { name: normalized });
}

watch(
  () => [props.open, props.family?.family.id] as const,
  ([open]) => {
    if (open) reset();
  },
);
watch(() => props.errors, (errors) => {
  if (errors.name) focusError();
}, { deep: true });
</script>

<template>
  <AppDialog
    :open="open"
    :title="isEditing ? '가족 이름 수정' : '새 가족 등록'"
    :description="isEditing ? familyLabel : '이름만으로 가족 묶음을 만들 수 있습니다.'"
    @close="emit('close')"
  >
    <form class="family-form" novalidate @submit.prevent="submit">
      <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>
      <label class="field">
        <span>가족 이름 <em>필수</em></span>
        <input
          ref="nameInput"
          v-model="name"
          name="name"
          maxlength="200"
          autocomplete="off"
          autofocus
          :aria-invalid="Boolean(nameError)"
          :aria-describedby="nameError ? 'family-name-error' : undefined"
          placeholder="예: 합성 보담 가족"
          @input="localError = undefined"
        />
        <small v-if="nameError" id="family-name-error" class="field-error">{{ nameError }}</small>
      </label>
      <p class="family-relationship-note" role="note">
        가족 이름에는 주민등록번호·보험사 로그인 정보·병력·진단·치료 내용을 입력하지 마세요.
      </p>
      <footer class="form-actions family-dialog-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting">
          {{ isEditing ? "이름 저장" : "가족 등록" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
