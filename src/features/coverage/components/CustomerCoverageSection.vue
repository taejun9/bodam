<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import { coverageBenchmarkApplication } from "@/app/composition/coverage-benchmark";
import { coverageApplication } from "@/app/composition/coverage";
import { categoryIdentityHint } from "@/features/coverage/components/coverage-category-label";
import CoverageCategoryDialog from "@/features/coverage/components/CoverageCategoryDialog.vue";
import type {
  Coverage,
  CoverageCategory,
} from "@/features/coverage/types/coverage";
import { coverageBenchmarkSafeMessage } from "@/features/coverage-benchmark/types/coverage-benchmark-error";
import type {
  CoverageAssessment,
  CoverageAssessmentStatus,
  CoverageBenchmark,
} from "@/features/coverage-benchmark/types/coverage-benchmark";
import { currentLocalDateOnly } from "@/features/coverage-benchmark/services/customer-full-age";
import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import AppButton from "@/shared/components/AppButton.vue";

const props = withDefaults(
  defineProps<{
    customer: Customer;
    policies: readonly InsurancePolicy[];
    refreshKey?: number;
  }>(),
  { refreshKey: 0 },
);
const emit = defineEmits<{ changed: [message: string] }>();

const categories = ref<CoverageCategory[]>([]);
const coverages = ref<Coverage[]>([]);
const benchmarks = ref<CoverageBenchmark[]>([]);
const assessments = ref<CoverageAssessment[]>([]);
const loading = ref(true);
const error = ref<string>();
const categoryDialogOpen = ref(false);
let loadNumber = 0;
const moneyFormatter = new Intl.NumberFormat("ko-KR");

const benchmarkUsageCounts = computed(() => Object.fromEntries(
  categories.value.map((category) => [
    category.id,
    coverageBenchmarkApplication.categoryBenchmarkUsageCount(benchmarks.value, category.id),
  ]),
));

const statusLabel: Record<CoverageAssessmentStatus, string> = {
  insufficient: "부족",
  adequate: "적정",
  excessive: "과다",
  unconfigured: "기준 미설정",
};

function assessmentMeta(assessment: CoverageAssessment): string {
  const identity = categoryIdentityHint(categories.value, assessment.categoryId);
  return identity
    ? `${identity} · 보장 ${assessment.coverageCount}건`
    : `보장 ${assessment.coverageCount}건`;
}

function assessmentTrace(assessment: CoverageAssessment): string {
  if (!assessment.benchmark) {
    return assessment.ageYears === null
      ? "생년월일·성별과 적용 기준을 확인해 주세요."
      : `만 ${assessment.ageYears}세 · 고객 정보와 정확히 일치하는 활성 기준 없음`;
  }
  const benchmark = assessment.benchmark;
  return `만 ${assessment.ageYears}세 · ${benchmark.gender} · 적정 ${moneyFormatter.format(benchmark.adequateMinWon)}원 이상 · 과다 ${moneyFormatter.format(benchmark.excessiveMinWon)}원 이상`;
}

async function load(showLoading = true) {
  const currentLoad = ++loadNumber;
  const expectedCustomerId = props.customer.id;
  const expectedCustomer = props.customer;
  const expectedPolicies = props.policies;
  if (showLoading) loading.value = true;
  error.value = undefined;
  try {
    const [loadedCategories, loadedCoverages, loadedBenchmarks] = await Promise.all([
      coverageApplication.listCategories(),
      coverageApplication.list(expectedCustomerId),
      coverageBenchmarkApplication.list(),
    ]);
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customer.id) return;
    categories.value = loadedCategories;
    coverages.value = loadedCoverages;
    benchmarks.value = loadedBenchmarks;
    assessments.value = coverageBenchmarkApplication.assessCustomer(
      expectedCustomer,
      loadedCategories,
      expectedPolicies,
      loadedCoverages,
      loadedBenchmarks,
      currentLocalDateOnly(),
    );
  } catch (loadError) {
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customer.id) return;
    categories.value = [];
    coverages.value = [];
    benchmarks.value = [];
    assessments.value = [];
    error.value = coverageBenchmarkSafeMessage(loadError);
  } finally {
    if (currentLoad === loadNumber) loading.value = false;
  }
}

async function categoryChanged(message: string) {
  await load(false);
  emit("changed", message);
}

watch(
  () => [props.customer, props.refreshKey, props.policies] as const,
  () => void load(),
  { immediate: true },
);
</script>

<template>
  <section
    class="coverage-summary surface"
    data-testid="coverage-summary"
    aria-labelledby="coverage-summary-title"
    :aria-busy="loading"
  >
    <header class="coverage-summary-header">
      <div>
        <h3 id="coverage-summary-title">고객 보장 합계와 비교 판정</h3>
        <p>합계대상 계약의 활성 보장과 사용자 설정 기준의 비교 결과입니다.</p>
      </div>
      <AppButton data-testid="manage-categories" @click="categoryDialogOpen = true">
        카테고리 관리
      </AppButton>
    </header>

    <aside class="coverage-benchmark-disclaimer">
      비교 판정은 사용자가 설정한 내부 기준이며 공식 보험 권고나 적합성 판단이 아닙니다.
      <RouterLink data-testid="coverage-settings-link" to="/settings">설정에서 기준 관리</RouterLink>
    </aside>

    <div v-if="loading" class="coverage-summary-state" role="status">
      <span class="button-spinner" aria-hidden="true" />
      <span>보장 합계를 불러오는 중입니다</span>
    </div>
    <div v-else-if="error" class="coverage-summary-state is-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="load()">다시 시도</button>
    </div>
    <div v-else-if="assessments.length === 0" class="coverage-summary-state">
      <strong>표시할 보장이나 일치 기준이 없습니다</strong>
      <span>보험계약의 보장을 등록하거나 설정에서 고객 정보와 일치하는 기준을 추가해 주세요.</span>
    </div>
    <ul v-else class="coverage-summary-grid">
      <li
        v-for="assessment in assessments"
        :key="assessment.categoryId"
        data-testid="coverage-assessment-row"
        :data-category-id="assessment.categoryId"
      >
        <div
          class="coverage-assessment-main"
          data-testid="coverage-summary-row"
          :data-category-id="assessment.categoryId"
        >
          <span>
            <strong>{{ assessment.categoryName }}</strong>
            <small>{{ assessmentMeta(assessment) }}</small>
          </span>
          <strong>{{ moneyFormatter.format(assessment.amountWon) }}원</strong>
        </div>
        <div class="coverage-assessment-result">
          <span
            class="coverage-status-chip"
            :class="`is-${assessment.status}`"
            data-testid="coverage-classification"
            :data-classification="assessment.status"
          >{{ statusLabel[assessment.status] }}</span>
          <small data-testid="coverage-assessment-trace">{{ assessmentTrace(assessment) }}</small>
        </div>
      </li>
    </ul>

    <CoverageCategoryDialog
      :open="categoryDialogOpen"
      :categories="categories"
      :coverages="coverages"
      :benchmark-usage-counts="benchmarkUsageCounts"
      @close="categoryDialogOpen = false"
      @changed="categoryChanged"
    />
  </section>
</template>
