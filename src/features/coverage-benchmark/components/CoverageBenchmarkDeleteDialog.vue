<script setup lang="ts">
import { computed } from "vue";

import type { CoverageCategory } from "@/features/coverage/types/coverage";
import type { CoverageBenchmark } from "@/features/coverage-benchmark/types/coverage-benchmark";
import AppButton from "@/shared/components/AppButton.vue";
import AppDialog from "@/shared/components/AppDialog.vue";

const props = withDefaults(
  defineProps<{
    open: boolean;
    benchmark?: CoverageBenchmark | null | undefined;
    categories: readonly CoverageCategory[];
    deleting?: boolean;
    error?: string | undefined;
  }>(),
  {
    benchmark: null,
    deleting: false,
    error: undefined,
  },
);

const emit = defineEmits<{ close: []; confirm: [] }>();

const categoryName = computed(() => {
  if (!props.benchmark) return "선택한 보장 기준";
  return props.categories.find((category) => category.id === props.benchmark?.categoryId)?.name
    ?? "보장 카테고리";
});
</script>

<template>
  <AppDialog :open="open" title="보장 비교 기준을 삭제할까요?" size="small" @close="emit('close')">
    <section class="benchmark-delete-content">
      <span class="benchmark-delete-symbol" aria-hidden="true">!</span>
      <div>
        <p>
          <strong>{{ categoryName }}</strong>
          <template v-if="benchmark"> · {{ benchmark.gender }} · 만 {{ benchmark.minAgeYears }}–{{ benchmark.maxAgeYears }}세</template>
          기준이 기본 목록과 고객 판정에서 제외됩니다.
        </p>
        <small v-if="benchmark" data-testid="benchmark-delete-identity">
          카테고리 ID {{ benchmark.categoryId }} · 기준 ID {{ benchmark.id }}
        </small>
        <small>기준 원본 행은 이 PC의 로컬 데이터베이스에 보존됩니다.</small>
      </div>
    </section>
    <p class="benchmark-disclaimer">
      이 기준은 사용자가 설정한 내부 비교 기준이며 공식 보험 권고나 적합성 판단이 아닙니다.
    </p>
    <p v-if="error" class="benchmark-delete-error" role="alert">{{ error }}</p>
    <footer class="form-actions benchmark-delete-actions">
      <AppButton :disabled="deleting" autofocus @click="emit('close')">취소</AppButton>
      <AppButton
        variant="danger"
        :loading="deleting"
        data-testid="confirm-delete-benchmark"
        @click="emit('confirm')"
      >기준 삭제</AppButton>
    </footer>
  </AppDialog>
</template>
