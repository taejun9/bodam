<script setup lang="ts">
import { computed } from "vue";

import {
  categoryDisplayLabel,
} from "@/features/coverage/components/coverage-category-label";
import type { CoverageCategory } from "@/features/coverage/types/coverage";
import type { CoverageBenchmark } from "@/features/coverage-benchmark/types/coverage-benchmark";

const props = defineProps<{
  benchmarks: readonly CoverageBenchmark[];
  categories: readonly CoverageCategory[];
}>();
const emit = defineEmits<{
  edit: [benchmark: CoverageBenchmark];
  remove: [benchmark: CoverageBenchmark];
}>();

const categoryById = computed(() => new Map(
  props.categories.map((category) => [category.id, category]),
));
const moneyFormatter = new Intl.NumberFormat("ko-KR");

function categoryLabel(benchmark: CoverageBenchmark): string {
  return categoryDisplayLabel(props.categories, benchmark.categoryId)
    || categoryById.value.get(benchmark.categoryId)?.name
    || "삭제된 카테고리";
}

function targetLabel(benchmark: CoverageBenchmark): string {
  return `${benchmark.gender} · 만 ${benchmark.minAgeYears}–${benchmark.maxAgeYears}세`;
}
</script>

<template>
  <div class="benchmark-table-wrap">
    <table class="benchmark-table">
      <thead>
        <tr>
          <th scope="col">카테고리</th>
          <th scope="col">정확히 일치할 대상</th>
          <th scope="col">적정 하한</th>
          <th scope="col">과다 하한</th>
          <th scope="col"><span class="sr-only">관리</span></th>
        </tr>
      </thead>
      <tbody>
        <tr
          v-for="benchmark in benchmarks"
          :key="benchmark.id"
          data-testid="benchmark-row"
          :data-benchmark-id="benchmark.id"
        >
          <td>
            <strong>{{ categoryLabel(benchmark) }}</strong>
            <small>기준 ID {{ benchmark.id }}</small>
          </td>
          <td>{{ targetLabel(benchmark) }}</td>
          <td class="benchmark-money">{{ moneyFormatter.format(benchmark.adequateMinWon) }}원</td>
          <td class="benchmark-money">{{ moneyFormatter.format(benchmark.excessiveMinWon) }}원</td>
          <td>
            <span class="benchmark-actions">
              <button
                type="button"
                data-testid="edit-benchmark"
                :data-benchmark-id="benchmark.id"
                :aria-label="`${categoryLabel(benchmark)} ${targetLabel(benchmark)} 기준 ID ${benchmark.id} 수정`"
                @click="emit('edit', benchmark)"
              >수정</button>
              <button
                class="danger-action"
                type="button"
                data-testid="delete-benchmark"
                :data-benchmark-id="benchmark.id"
                :aria-label="`${categoryLabel(benchmark)} ${targetLabel(benchmark)} 기준 ID ${benchmark.id} 삭제`"
                @click="emit('remove', benchmark)"
              >삭제</button>
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>

  <ul class="benchmark-card-list" aria-label="보장 비교 기준 목록">
    <li
      v-for="benchmark in benchmarks"
      :key="benchmark.id"
      data-testid="benchmark-card"
      :data-benchmark-id="benchmark.id"
    >
      <header>
        <strong>{{ categoryLabel(benchmark) }}</strong>
        <span>{{ targetLabel(benchmark) }}</span>
      </header>
      <dl>
        <div><dt>적정 하한</dt><dd>{{ moneyFormatter.format(benchmark.adequateMinWon) }}원</dd></div>
        <div><dt>과다 하한</dt><dd>{{ moneyFormatter.format(benchmark.excessiveMinWon) }}원</dd></div>
      </dl>
      <small>기준 ID {{ benchmark.id }}</small>
      <footer class="benchmark-actions">
        <button
          type="button"
          data-testid="edit-benchmark"
          :data-benchmark-id="benchmark.id"
          :aria-label="`${categoryLabel(benchmark)} ${targetLabel(benchmark)} 기준 ID ${benchmark.id} 수정`"
          @click="emit('edit', benchmark)"
        >수정</button>
        <button
          class="danger-action"
          type="button"
          data-testid="delete-benchmark"
          :data-benchmark-id="benchmark.id"
          :aria-label="`${categoryLabel(benchmark)} ${targetLabel(benchmark)} 기준 ID ${benchmark.id} 삭제`"
          @click="emit('remove', benchmark)"
        >삭제</button>
      </footer>
    </li>
  </ul>
</template>
