<script setup lang="ts">
import {
  categoryDisplayLabel,
  categoryIdentityHint,
  categoryName,
} from "@/features/coverage/components/coverage-category-label";
import type { Coverage, CoverageCategory } from "@/features/coverage/types/coverage";
import AppButton from "@/shared/components/AppButton.vue";

withDefaults(
  defineProps<{
    coverages: readonly Coverage[];
    categories: readonly CoverageCategory[];
    loading?: boolean;
    error?: string | undefined;
  }>(),
  { loading: false, error: undefined },
);

const emit = defineEmits<{
  create: [event: MouseEvent];
  edit: [coverage: Coverage, event: MouseEvent];
  remove: [coverage: Coverage, event: MouseEvent];
  retry: [];
}>();

const moneyFormatter = new Intl.NumberFormat("ko-KR");

</script>

<template>
  <section class="coverage-dialog-list" :aria-busy="loading">
    <div v-if="loading" class="coverage-dialog-state" role="status">
      <span class="button-spinner" aria-hidden="true" />
      <strong>보장 내역을 불러오는 중입니다</strong>
    </div>

    <div v-else-if="error" class="coverage-dialog-state is-error" role="alert">
      <strong>보장 내역을 불러오지 못했습니다</strong>
      <span>{{ error }}</span>
      <AppButton autofocus @click="emit('retry')">다시 시도</AppButton>
    </div>

    <template v-else>
      <header class="coverage-dialog-toolbar">
        <div>
          <strong>등록된 보장 {{ coverages.length }}건</strong>
          <small>카테고리와 가입금액만 저장합니다.</small>
        </div>
        <AppButton
          data-testid="create-coverage"
          :disabled="categories.length === 0"
          autofocus
          @click="emit('create', $event)"
        >
          + 보장 등록
        </AppButton>
      </header>

      <div v-if="categories.length === 0" class="coverage-dialog-state is-compact">
        <strong>사용 가능한 카테고리가 없습니다</strong>
        <span>카테고리 관리에서 활성 카테고리를 확인해 주세요.</span>
      </div>
      <div v-else-if="coverages.length === 0" class="coverage-dialog-state is-compact">
        <strong>이 계약에 등록된 보장이 없습니다</strong>
        <span>보장 카테고리와 가입금액으로 첫 항목을 등록해 보세요.</span>
      </div>

      <ul v-else class="coverage-row-list">
        <li
          v-for="coverage in coverages"
          :key="coverage.id"
          data-testid="coverage-row"
          :data-category-id="coverage.categoryId"
        >
          <span class="coverage-row-name">
            <strong>{{ categoryName(categories, coverage.categoryId) }}</strong>
            <small>{{ categoryIdentityHint(categories, coverage.categoryId) ?? "보장 가입금액" }}</small>
          </span>
          <strong class="coverage-row-amount">{{ moneyFormatter.format(coverage.amountWon) }}원</strong>
          <span class="coverage-row-actions">
            <button
              type="button"
              :aria-label="`${categoryDisplayLabel(categories, coverage.categoryId)} 보장 수정`"
              @click="emit('edit', coverage, $event)"
            >수정</button>
            <button
              class="danger-action"
              type="button"
              :aria-label="`${categoryDisplayLabel(categories, coverage.categoryId)} 보장 삭제`"
              @click="emit('remove', coverage, $event)"
            >삭제</button>
          </span>
        </li>
      </ul>
    </template>
  </section>
</template>
