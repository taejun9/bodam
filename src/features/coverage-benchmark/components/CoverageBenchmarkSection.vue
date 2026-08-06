<script setup lang="ts">
import { nextTick, ref } from "vue";

import { coverageBenchmarkApplication } from "@/app/composition/coverage-benchmark";
import { coverageApplication } from "@/app/composition/coverage";
import type { CoverageCategory } from "@/features/coverage/types/coverage";
import CoverageBenchmarkDeleteDialog from "@/features/coverage-benchmark/components/CoverageBenchmarkDeleteDialog.vue";
import CoverageBenchmarkFormDialog from "@/features/coverage-benchmark/components/CoverageBenchmarkFormDialog.vue";
import CoverageBenchmarkList from "@/features/coverage-benchmark/components/CoverageBenchmarkList.vue";
import type {
  CoverageBenchmarkFieldErrors,
  CoverageBenchmarkFieldName,
} from "@/features/coverage-benchmark/components/coverage-benchmark-form";
import {
  CoverageBenchmarkValidationError,
  coverageBenchmarkSafeMessage,
} from "@/features/coverage-benchmark/types/coverage-benchmark-error";
import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "@/features/coverage-benchmark/types/coverage-benchmark";
import AppButton from "@/shared/components/AppButton.vue";

const benchmarks = ref<CoverageBenchmark[]>([]);
const categories = ref<CoverageCategory[]>([]);
const loading = ref(true);
const error = ref<string>();
const notice = ref<string>();
const sectionElement = ref<HTMLElement>();

const formOpen = ref(false);
const selected = ref<CoverageBenchmark>();
const submitting = ref(false);
const formErrors = ref<CoverageBenchmarkFieldErrors>({});
const formSubmitError = ref<string>();

const deleteOpen = ref(false);
const deletingBenchmark = ref<CoverageBenchmark>();
const deleting = ref(false);
const deleteError = ref<string>();
let loadNumber = 0;

async function focusCreateAction() {
  await nextTick();
  sectionElement.value
    ?.querySelector<HTMLElement>("[data-testid='create-benchmark']")
    ?.focus();
}

async function load(showLoading = true) {
  const currentLoad = ++loadNumber;
  if (showLoading) loading.value = true;
  error.value = undefined;
  try {
    const [loadedBenchmarks, loadedCategories] = await Promise.all([
      coverageBenchmarkApplication.list(),
      coverageApplication.listCategories(),
    ]);
    if (currentLoad !== loadNumber) return;
    benchmarks.value = loadedBenchmarks;
    categories.value = loadedCategories;
  } catch (loadError) {
    if (currentLoad !== loadNumber) return;
    benchmarks.value = [];
    categories.value = [];
    error.value = coverageBenchmarkSafeMessage(loadError);
  } finally {
    if (currentLoad === loadNumber) loading.value = false;
  }
}

function beginCreate() {
  selected.value = undefined;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function beginEdit(benchmark: CoverageBenchmark) {
  selected.value = benchmark;
  formErrors.value = {};
  formSubmitError.value = undefined;
  formOpen.value = true;
}

function closeForm() {
  if (!submitting.value) formOpen.value = false;
}

function clearFormError(field: CoverageBenchmarkFieldName) {
  const next = { ...formErrors.value };
  delete next[field];
  formErrors.value = next;
  formSubmitError.value = undefined;
}

async function save(input: CoverageBenchmarkInput) {
  submitting.value = true;
  formErrors.value = {};
  formSubmitError.value = undefined;
  try {
    if (selected.value) {
      await coverageBenchmarkApplication.update(selected.value.id, input);
      notice.value = "보장 비교 기준을 수정했습니다.";
    } else {
      await coverageBenchmarkApplication.create(input);
      notice.value = "보장 비교 기준을 등록했습니다.";
    }
    await load(false);
    formOpen.value = false;
    selected.value = undefined;
    await focusCreateAction();
  } catch (saveError) {
    if (saveError instanceof CoverageBenchmarkValidationError) {
      formErrors.value = Object.fromEntries(
        saveError.issues.map((issue) => [issue.field, issue.message]),
      ) as CoverageBenchmarkFieldErrors;
    } else {
      formSubmitError.value = coverageBenchmarkSafeMessage(saveError);
    }
  } finally {
    submitting.value = false;
  }
}

function requestDelete(benchmark: CoverageBenchmark) {
  deletingBenchmark.value = benchmark;
  deleteError.value = undefined;
  deleteOpen.value = true;
}

function closeDelete() {
  if (!deleting.value) deleteOpen.value = false;
}

async function confirmDelete() {
  if (!deletingBenchmark.value) return;
  deleting.value = true;
  deleteError.value = undefined;
  try {
    await coverageBenchmarkApplication.remove(deletingBenchmark.value.id);
    await load(false);
    deleteOpen.value = false;
    deletingBenchmark.value = undefined;
    notice.value = "보장 비교 기준을 기본 목록에서 삭제했습니다.";
    await focusCreateAction();
  } catch (removeError) {
    deleteError.value = coverageBenchmarkSafeMessage(removeError);
  } finally {
    deleting.value = false;
  }
}

void load();
</script>

<template>
  <section
    ref="sectionElement"
    class="benchmark-section surface"
    data-testid="benchmark-section"
    aria-labelledby="benchmark-section-title"
    :aria-busy="loading"
  >
    <header class="benchmark-section-header">
      <div>
        <span>Coverage benchmark</span>
        <h3 id="benchmark-section-title">보장 비교 기준</h3>
        <p>활성 카테고리와 고객의 정확한 성별 저장값·포함 만나이 구간별 금액 기준입니다.</p>
      </div>
      <AppButton
        variant="primary"
        data-testid="create-benchmark"
        :disabled="loading || categories.length === 0"
        :aria-describedby="categories.length === 0 && !loading ? 'benchmark-category-empty-note' : undefined"
        @click="beginCreate"
      >
        <span class="button-plus" aria-hidden="true">+</span>
        기준 등록
      </AppButton>
    </header>

    <aside class="benchmark-disclaimer" data-testid="benchmark-disclaimer">
      이 기준과 고객 판정은 사용자가 설정한 내부 비교 정보이며 공식 보험 권고나 적합성 판단이 아닙니다.
    </aside>
    <p class="benchmark-formula">
      판정식: 가입금액 &lt; 적정 하한은 부족, 적정 하한 이상 과다 하한 미만은 적정, 과다 하한 이상은 과다입니다.
    </p>
    <p v-if="notice" class="toast-notice" role="status">{{ notice }}</p>

    <div v-if="loading" class="benchmark-state" role="status">
      <span class="button-spinner" aria-hidden="true" />
      <strong>보장 비교 기준을 불러오는 중입니다</strong>
      <span>이 PC에 저장된 기준과 활성 카테고리를 확인하고 있습니다.</span>
    </div>
    <div v-else-if="error" class="benchmark-state is-error" role="alert">
      <strong>보장 비교 기준을 불러오지 못했습니다</strong>
      <span>{{ error }}</span>
      <button type="button" @click="load()">다시 시도</button>
    </div>
    <div v-else-if="categories.length === 0" id="benchmark-category-empty-note" class="benchmark-state">
      <strong>사용할 수 있는 보장 카테고리가 없습니다</strong>
      <span>보장 카테고리가 활성화되어야 비교 기준을 등록할 수 있습니다.</span>
    </div>
    <div v-else-if="benchmarks.length === 0" class="benchmark-state">
      <strong>등록된 보장 비교 기준이 없습니다</strong>
      <span>필요한 범위만 직접 설정하세요. 권고 기준은 자동으로 제공하지 않습니다.</span>
      <AppButton @click="beginCreate">첫 기준 등록</AppButton>
    </div>
    <CoverageBenchmarkList
      v-else
      :benchmarks="benchmarks"
      :categories="categories"
      @edit="beginEdit"
      @remove="requestDelete"
    />

    <CoverageBenchmarkFormDialog
      :open="formOpen"
      :categories="categories"
      :benchmark="selected"
      :submitting="submitting"
      :errors="formErrors"
      :submit-error="formSubmitError"
      @close="closeForm"
      @submit="save"
      @clear-error="clearFormError"
    />
    <CoverageBenchmarkDeleteDialog
      :open="deleteOpen"
      :benchmark="deletingBenchmark"
      :categories="categories"
      :deleting="deleting"
      :error="deleteError"
      @close="closeDelete"
      @confirm="confirmDelete"
    />
  </section>
</template>
