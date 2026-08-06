<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";

import type {
  Consultation,
  ConsultationInput,
} from "@/features/consultation/types/consultation";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

import {
  consultationInputFromForm,
  createConsultationFormState,
  resetConsultationForm,
  type ConsultationFieldErrors,
  type ConsultationFieldName,
} from "./consultation-form";

const props = withDefaults(
  defineProps<{
    open: boolean;
    consultation?: Consultation | null | undefined;
    submitting?: boolean;
    errors?: ConsultationFieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    consultation: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [input: ConsultationInput];
  clearError: [field: ConsultationFieldName];
}>();

const formElement = ref<HTMLFormElement>();
const localErrors = reactive<ConsultationFieldErrors>({});
const form = reactive(createConsultationFormState());
const isEditing = computed(() => props.consultation !== null);

function errorFor(field: ConsultationFieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function describedBy(field: ConsultationFieldName): string | undefined {
  const ids: string[] = [];
  if (field === "content") ids.push("consultation-content-privacy");
  if (field === "result") ids.push("consultation-result-limit");
  if (errorFor(field)) ids.push(`consultation-${field}-error`);
  return ids.length > 0 ? ids.join(" ") : undefined;
}

function clearError(field: ConsultationFieldName) {
  delete localErrors[field];
  emit("clearError", field);
}

function focusFirstError() {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function submit() {
  const input = consultationInputFromForm(form, localErrors);
  if (input === undefined) {
    focusFirstError();
    return;
  }
  emit("submit", input);
}

watch(
  () => [props.open, props.consultation?.id] as const,
  ([open]) => {
    if (open) resetConsultationForm(form, props.consultation, localErrors);
  },
  { immediate: true },
);

watch(
  () => props.errors,
  (errors) => {
    if (Object.keys(errors).length > 0) focusFirstError();
  },
  { deep: true },
);
</script>

<template>
  <AppDialog
    :open="open"
    :title="isEditing ? '상담 기록 수정' : '새 상담 기록'"
    description="상담 일시는 필수이며 현재 PC의 지역 시간으로 입력합니다."
    size="large"
    @close="emit('close')"
  >
    <form ref="formElement" class="consultation-form" novalidate @submit.prevent="submit">
      <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>
      <div class="form-grid">
        <label class="field field-wide">
          <span>상담 일시 <em>필수</em></span>
          <input
            v-model="form.consultedAt"
            name="consultedAt"
            type="datetime-local"
            step="0.001"
            autofocus
            :aria-invalid="Boolean(errorFor('consultedAt'))"
            :aria-describedby="describedBy('consultedAt')"
            @input="clearError('consultedAt')"
          />
          <small
            v-if="errorFor('consultedAt')"
            id="consultation-consultedAt-error"
            class="field-error"
          >{{ errorFor("consultedAt") }}</small>
        </label>

        <label class="field field-wide">
          <span>상담 내용</span>
          <textarea
            v-model="form.content"
            name="content"
            rows="6"
            placeholder="요청 사항과 다음 단계를 필요한 만큼만 기록하세요."
            :aria-invalid="Boolean(errorFor('content'))"
            :aria-describedby="describedBy('content')"
            @input="clearError('content')"
          />
          <small id="consultation-content-privacy" class="privacy-hint">
            민감 병력이나 상세 병력은 상담 내용에 저장하지 마세요. 최대 4,000자입니다.
          </small>
          <small
            v-if="errorFor('content')"
            id="consultation-content-error"
            class="field-error"
          >{{ errorFor("content") }}</small>
        </label>

        <label class="field">
          <span>다음 연락일</span>
          <input
            v-model="form.nextContactOn"
            name="nextContactOn"
            type="date"
            :aria-invalid="Boolean(errorFor('nextContactOn'))"
            :aria-describedby="describedBy('nextContactOn')"
            @input="clearError('nextContactOn')"
          />
          <small
            v-if="errorFor('nextContactOn')"
            id="consultation-nextContactOn-error"
            class="field-error"
          >{{ errorFor("nextContactOn") }}</small>
        </label>

        <label class="field">
          <span>상담 결과</span>
          <input
            v-model="form.result"
            name="result"
            autocomplete="off"
            placeholder="선택 자유입력"
            :aria-invalid="Boolean(errorFor('result'))"
            :aria-describedby="describedBy('result')"
            @input="clearError('result')"
          />
          <small id="consultation-result-limit" class="consultation-limit-hint">
            자유입력 결과는 최대 200자입니다.
          </small>
          <small
            v-if="errorFor('result')"
            id="consultation-result-error"
            class="field-error"
          >{{ errorFor("result") }}</small>
        </label>
      </div>

      <footer class="form-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting">
          {{ isEditing ? "변경사항 저장" : "상담 기록 저장" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
