<script setup lang="ts">
import { computed, nextTick, reactive, ref, watch } from "vue";

import {
  categoryDisplayLabel,
} from "@/features/coverage/components/coverage-category-label";
import type { CoverageCategory } from "@/features/coverage/types/coverage";
import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "@/features/coverage-benchmark/types/coverage-benchmark";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

import {
  coverageBenchmarkInputFromForm,
  createCoverageBenchmarkFormState,
  resetCoverageBenchmarkForm,
  type CoverageBenchmarkFieldErrors,
  type CoverageBenchmarkFieldName,
} from "./coverage-benchmark-form";

const props = withDefaults(
  defineProps<{
    open: boolean;
    categories: readonly CoverageCategory[];
    benchmark?: CoverageBenchmark | null | undefined;
    submitting?: boolean;
    errors?: CoverageBenchmarkFieldErrors;
    submitError?: string | undefined;
  }>(),
  {
    benchmark: null,
    submitting: false,
    errors: () => ({}),
    submitError: undefined,
  },
);

const emit = defineEmits<{
  close: [];
  submit: [input: CoverageBenchmarkInput];
  clearError: [field: CoverageBenchmarkFieldName];
}>();

const formElement = ref<HTMLFormElement>();
const form = reactive(createCoverageBenchmarkFormState());
const localErrors = reactive<CoverageBenchmarkFieldErrors>({});
const isEditing = computed(() => props.benchmark !== null);

function errorFor(field: CoverageBenchmarkFieldName): string | undefined {
  return localErrors[field] ?? props.errors[field];
}

function clearError(field: CoverageBenchmarkFieldName) {
  delete localErrors[field];
  emit("clearError", field);
}

function focusFirstError() {
  void nextTick(() => {
    formElement.value?.querySelector<HTMLElement>("[aria-invalid='true']")?.focus();
  });
}

function submit() {
  const input = coverageBenchmarkInputFromForm(form, localErrors);
  if (!input) {
    focusFirstError();
    return;
  }
  emit("submit", input);
}

watch(
  () => [props.open, props.benchmark?.id] as const,
  ([open]) => {
    if (open) resetCoverageBenchmarkForm(form, props.benchmark, localErrors);
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
    :title="isEditing ? '보장 비교 기준 수정' : '새 보장 비교 기준'"
    description="카테고리·성별 저장값·포함 만나이 구간별 금액 기준을 입력합니다."
    size="large"
    :busy="submitting"
    :dismiss-disabled="submitting"
    @close="emit('close')"
  >
    <form
      ref="formElement"
      class="benchmark-form"
      data-testid="benchmark-form"
      novalidate
      @submit.prevent="submit"
    >
      <aside id="benchmark-advice-disclaimer" class="benchmark-disclaimer">
        이 기준은 사용자가 설정한 내부 비교 기준이며 공식 보험 권고나 적합성 판단이 아닙니다.
      </aside>
      <p v-if="submitError" class="form-submit-error" role="alert">{{ submitError }}</p>

      <div class="form-grid benchmark-form-grid">
        <label class="field field-wide">
          <span>보장 카테고리 <em>필수</em></span>
          <select
            v-model="form.categoryId"
            name="categoryId"
            autofocus
            :aria-invalid="Boolean(errorFor('categoryId'))"
            :aria-describedby="errorFor('categoryId') ? 'benchmark-categoryId-error' : undefined"
            @change="clearError('categoryId')"
          >
            <option value="" disabled>카테고리 선택</option>
            <option v-for="category in categories" :key="category.id" :value="category.id">
              {{ categoryDisplayLabel(categories, category.id) }}
            </option>
          </select>
          <small v-if="errorFor('categoryId')" id="benchmark-categoryId-error" class="field-error">
            {{ errorFor("categoryId") }}
          </small>
        </label>

        <label class="field field-wide">
          <span>고객 성별 저장값 <em>필수</em></span>
          <input
            v-model="form.gender"
            name="gender"
            autocomplete="off"
            placeholder="예: 여성"
            :aria-invalid="Boolean(errorFor('gender'))"
            :aria-describedby="errorFor('gender') ? 'benchmark-gender-note benchmark-gender-error' : 'benchmark-gender-note'"
            @input="clearError('gender')"
          />
          <small id="benchmark-gender-note" class="benchmark-field-hint">
            고객에 저장된 값을 공백 제거 후 대소문자까지 정확히 비교합니다. 전체 조건은 없습니다. 최대 100자입니다.
          </small>
          <small v-if="errorFor('gender')" id="benchmark-gender-error" class="field-error">
            {{ errorFor("gender") }}
          </small>
        </label>

        <label class="field">
          <span>최소 만나이 <em>필수</em></span>
          <input
            v-model="form.minAgeYears"
            name="minAgeYears"
            inputmode="numeric"
            autocomplete="off"
            placeholder="0"
            :aria-invalid="Boolean(errorFor('minAgeYears'))"
            :aria-describedby="errorFor('minAgeYears') ? 'benchmark-minAgeYears-error' : undefined"
            @input="clearError('minAgeYears')"
          />
          <small v-if="errorFor('minAgeYears')" id="benchmark-minAgeYears-error" class="field-error">
            {{ errorFor("minAgeYears") }}
          </small>
        </label>

        <label class="field">
          <span>최대 만나이 <em>필수</em></span>
          <input
            v-model="form.maxAgeYears"
            name="maxAgeYears"
            inputmode="numeric"
            autocomplete="off"
            placeholder="150"
            :aria-invalid="Boolean(errorFor('maxAgeYears'))"
            :aria-describedby="errorFor('maxAgeYears') ? 'benchmark-maxAgeYears-error' : undefined"
            @input="clearError('maxAgeYears')"
          />
          <small v-if="errorFor('maxAgeYears')" id="benchmark-maxAgeYears-error" class="field-error">
            {{ errorFor("maxAgeYears") }}
          </small>
        </label>

        <label class="field">
          <span>적정 하한 <em>필수</em></span>
          <input
            v-model="form.adequateMinWon"
            name="adequateMinWon"
            inputmode="numeric"
            autocomplete="off"
            placeholder="50000000"
            :aria-invalid="Boolean(errorFor('adequateMinWon'))"
            :aria-describedby="errorFor('adequateMinWon') ? 'benchmark-money-note benchmark-adequateMinWon-error' : 'benchmark-money-note'"
            @input="clearError('adequateMinWon')"
          />
          <small id="benchmark-money-note" class="benchmark-field-hint">쉼표 없이 원 단위 정수로 입력합니다.</small>
          <small v-if="errorFor('adequateMinWon')" id="benchmark-adequateMinWon-error" class="field-error">
            {{ errorFor("adequateMinWon") }}
          </small>
        </label>

        <label class="field">
          <span>과다 하한 <em>필수</em></span>
          <input
            v-model="form.excessiveMinWon"
            name="excessiveMinWon"
            inputmode="numeric"
            autocomplete="off"
            placeholder="100000000"
            :aria-invalid="Boolean(errorFor('excessiveMinWon'))"
            :aria-describedby="errorFor('excessiveMinWon') ? 'benchmark-threshold-note benchmark-excessiveMinWon-error' : 'benchmark-threshold-note'"
            @input="clearError('excessiveMinWon')"
          />
          <small id="benchmark-threshold-note" class="benchmark-field-hint">
            금액 &lt; 적정 하한: 부족 · 적정 하한 ≤ 금액 &lt; 과다 하한: 적정 · 과다 하한 ≤ 금액: 과다
          </small>
          <small v-if="errorFor('excessiveMinWon')" id="benchmark-excessiveMinWon-error" class="field-error">
            {{ errorFor("excessiveMinWon") }}
          </small>
        </label>
      </div>

      <footer class="form-actions benchmark-form-actions">
        <AppButton :disabled="submitting" @click="emit('close')">취소</AppButton>
        <AppButton variant="primary" type="submit" :loading="submitting" data-testid="save-benchmark">
          {{ isEditing ? "변경사항 저장" : "기준 저장" }}
        </AppButton>
      </footer>
    </form>
  </AppDialog>
</template>
