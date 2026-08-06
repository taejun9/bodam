<script setup lang="ts">
import { ref, watch } from "vue";

import { coverageApplication } from "@/app/composition/coverage";
import { categoryIdentityHint } from "@/features/coverage/components/coverage-category-label";
import CoverageCategoryDialog from "@/features/coverage/components/CoverageCategoryDialog.vue";
import { coverageSafeMessage } from "@/features/coverage/types/coverage-error";
import type {
  Coverage,
  CoverageCategory,
  CoverageSummary,
} from "@/features/coverage/types/coverage";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import AppButton from "@/shared/components/AppButton.vue";

const props = withDefaults(
  defineProps<{
    customerId: string;
    policies: readonly InsurancePolicy[];
    refreshKey?: number;
  }>(),
  { refreshKey: 0 },
);
const emit = defineEmits<{ changed: [message: string] }>();

const categories = ref<CoverageCategory[]>([]);
const coverages = ref<Coverage[]>([]);
const summaries = ref<CoverageSummary[]>([]);
const loading = ref(true);
const error = ref<string>();
const categoryDialogOpen = ref(false);
let loadNumber = 0;
const moneyFormatter = new Intl.NumberFormat("ko-KR");

function summaryMeta(summary: CoverageSummary): string {
  const identity = categoryIdentityHint(categories.value, summary.categoryId);
  return identity ? `${identity} · ${summary.coverageCount}건` : `${summary.coverageCount}건`;
}

async function load(showLoading = true) {
  const currentLoad = ++loadNumber;
  const expectedCustomerId = props.customerId;
  const expectedPolicies = props.policies;
  if (showLoading) loading.value = true;
  error.value = undefined;
  try {
    const [loadedCategories, loadedCoverages] = await Promise.all([
      coverageApplication.listCategories(),
      coverageApplication.list(expectedCustomerId),
    ]);
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customerId) return;
    categories.value = loadedCategories;
    coverages.value = loadedCoverages;
    summaries.value = coverageApplication.summary(
      loadedCategories,
      expectedPolicies,
      loadedCoverages,
    );
  } catch (loadError) {
    if (currentLoad !== loadNumber || expectedCustomerId !== props.customerId) return;
    categories.value = [];
    coverages.value = [];
    summaries.value = [];
    error.value = coverageSafeMessage(loadError);
  } finally {
    if (currentLoad === loadNumber) loading.value = false;
  }
}

async function categoryChanged(message: string) {
  await load(false);
  emit("changed", message);
}

watch(
  () => [props.customerId, props.refreshKey, props.policies] as const,
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
        <h3 id="coverage-summary-title">고객 보장 합계</h3>
        <p>합계대상 계약의 활성 보장을 카테고리별로 표시합니다.</p>
      </div>
      <AppButton data-testid="manage-categories" @click="categoryDialogOpen = true">
        카테고리 관리
      </AppButton>
    </header>

    <div v-if="loading" class="coverage-summary-state" role="status">
      <span class="button-spinner" aria-hidden="true" />
      <span>보장 합계를 불러오는 중입니다</span>
    </div>
    <div v-else-if="error" class="coverage-summary-state is-error" role="alert">
      <span>{{ error }}</span>
      <button type="button" @click="load()">다시 시도</button>
    </div>
    <div v-else-if="summaries.length === 0" class="coverage-summary-state">
      <strong>합계에 반영할 보장이 없습니다</strong>
      <span>보험계약의 ‘보장 관리’에서 카테고리와 가입금액을 등록해 주세요.</span>
    </div>
    <ul v-else class="coverage-summary-grid">
      <li
        v-for="summary in summaries"
        :key="summary.categoryId"
        data-testid="coverage-summary-row"
        :data-category-id="summary.categoryId"
      >
        <span>
          <strong>{{ summary.categoryName }}</strong>
          <small>{{ summaryMeta(summary) }}</small>
        </span>
        <strong>{{ moneyFormatter.format(summary.amountWon) }}원</strong>
      </li>
    </ul>

    <CoverageCategoryDialog
      :open="categoryDialogOpen"
      :categories="categories"
      :coverages="coverages"
      @close="categoryDialogOpen = false"
      @changed="categoryChanged"
    />
  </section>
</template>
