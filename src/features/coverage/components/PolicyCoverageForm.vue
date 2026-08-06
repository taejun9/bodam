<script setup lang="ts">
import { nextTick, reactive, ref, watch } from "vue";

import {
  coverageInputFromForm,
  createCoverageFormState,
  resetCoverageForm,
  type CoverageFieldErrors,
  type CoverageFieldName,
} from "@/features/coverage/components/coverage-form";
import { categoryDisplayLabel } from "@/features/coverage/components/coverage-category-label";
import type {
  Coverage,
  CoverageCategory,
  CoverageInput,
} from "@/features/coverage/types/coverage";
import AppButton from "@/shared/components/AppButton.vue";

const props = withDefaults(
  defineProps<{
    coverage?: Coverage | null | undefined;
    categories: readonly CoverageCategory[];
    submitting?: boolean;
    errors?: CoverageFieldErrors;
    submitError?: string | undefined;
  }>(),
  { coverage: null, submitting: false, errors: () => ({}), submitError: undefined },
);

const emit = defineEmits<{
  cancel: [];
  submit: [input: CoverageInput];
}>();

const formElement = ref<HTMLFormElement>();
const form = reactive(createCoverageFormState());
const localErrors = reactive<CoverageFieldErrors>({});

function errorFor(field: CoverageFieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function clearError(field: CoverageFieldName) {
  delete localErrors[field];
}

function focusFirstError() {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function submit() {
  const input = coverageInputFromForm(form, localErrors);
  if (!input) return focusFirstError();
  emit("submit", input);
}

watch(
  () => props.coverage?.id,
  () => resetCoverageForm(form, props.coverage, localErrors),
  { immediate: true },
);
watch(() => props.errors, (errors) => {
  if (Object.keys(errors).length > 0) focusFirstError();
}, { deep: true });
</script>

<template>
  <form ref="formElement" class="coverage-form" novalidate @submit.prevent="submit">
    <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>
    <label class="field">
      <span>보장 카테고리 <em>필수</em></span>
      <select
        v-model="form.categoryId"
        name="categoryId"
        autofocus
        :aria-invalid="Boolean(errorFor('categoryId'))"
        @change="clearError('categoryId')"
      >
        <option disabled value="">카테고리를 선택하세요</option>
        <option v-for="category in categories" :key="category.id" :value="category.id">
          {{ categoryDisplayLabel(categories, category.id) }}
        </option>
      </select>
      <small v-if="errorFor('categoryId')" class="field-error">{{ errorFor("categoryId") }}</small>
    </label>

    <label class="field">
      <span>보장금액 <em>필수</em></span>
      <div class="money-input">
        <input
          v-model="form.amountWon"
          name="amountWon"
          inputmode="numeric"
          maxlength="19"
          autocomplete="off"
          placeholder="예: 50000000"
          :aria-invalid="Boolean(errorFor('amountWon'))"
          @input="clearError('amountWon')"
        />
        <span>원</span>
      </div>
      <small v-if="errorFor('amountWon')" class="field-error">{{ errorFor("amountWon") }}</small>
    </label>

    <p class="coverage-privacy-note">
      보장 유형과 금액만 기록합니다. 진단·치료·입원·청구 또는 상세 병력은 입력하지 마세요.
    </p>
    <footer class="form-actions coverage-form-actions">
      <AppButton :disabled="submitting" @click="emit('cancel')">목록으로</AppButton>
      <AppButton variant="primary" type="submit" :loading="submitting">
        {{ coverage ? "변경사항 저장" : "보장 등록" }}
      </AppButton>
    </footer>
  </form>
</template>
