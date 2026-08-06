<script setup lang="ts">
import { ref, type ComponentPublicInstance } from "vue";

import type {
  ImportUiCustomer,
  ImportUiRow,
  ImportUiRowDecision,
  NewCustomerDefinition,
} from "./data-exchange-ui";
import DataExchangeRowControls from "./DataExchangeRowControls.vue";
import DataExchangeSourceDetail from "./DataExchangeSourceDetail.vue";

defineProps<{
  rows: readonly ImportUiRow[];
  decisions: ReadonlyMap<number, ImportUiRowDecision>;
  customers: readonly ImportUiCustomer[];
  newCustomers: readonly NewCustomerDefinition[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  change: [decision: ImportUiRowDecision];
  createCustomer: [sourceRow: number];
}>();

const expandedRows = ref(new Set<number>());
const rowButtons = new Map<number, HTMLButtonElement>();

function toggle(sourceRow: number) {
  const next = new Set(expandedRows.value);
  if (next.has(sourceRow)) next.delete(sourceRow);
  else next.add(sourceRow);
  expandedRows.value = next;
}

function setRowButton(
  sourceRow: number,
  element: Element | ComponentPublicInstance | null,
) {
  if (element instanceof HTMLButtonElement) rowButtons.set(sourceRow, element);
  else rowButtons.delete(sourceRow);
}

function focusRow(sourceRow: number) {
  if (!expandedRows.value.has(sourceRow)) toggle(sourceRow);
  requestAnimationFrame(() => rowButtons.get(sourceRow)?.focus());
}

defineExpose({ focusRow });
</script>

<template>
  <div class="preview-cards" data-testid="import-preview-cards">
    <article
      v-for="row in rows"
      :key="row.sourceRow"
      data-testid="import-row"
      :data-source-row="row.sourceRow"
      :data-row-state="row.issues.length ? 'invalid' : 'valid'"
      :data-duplicate-state="row.duplicateCandidates.length || row.batchDuplicateOf !== null ? 'duplicate' : 'new'"
    >
      <header>
        <span>원본 {{ row.sourceRow }}행</span>
        <strong :class="row.issues.length ? 'is-invalid' : 'is-valid'">
          {{ row.issues.length ? `오류 ${row.issues.length}건` : "사용 가능" }}
        </strong>
      </header>

      <div v-if="row.mapped" class="card-policy">
        <strong>{{ row.mapped.productName }}</strong>
        <span>{{ row.mapped.insurer }}</span>
        <small>{{ row.mapped.monthlyPremiumWon }}원</small>
      </div>

      <ul v-if="row.issues.length" class="card-issues">
        <li v-for="issue in row.issues" :key="`${issue.field}:${issue.code}`">
          {{ issue.message }}
        </li>
      </ul>
      <p
        v-else-if="row.duplicateCandidates.length || row.batchDuplicateOf !== null"
        class="duplicate-note"
      >
        {{ row.batchDuplicateOf
          ? `${row.batchDuplicateOf}행과 파일 내 중복`
          : `중복 후보 ${row.duplicateCandidates.length}건` }} — 기본값은 건너뛰기입니다.
      </p>

      <DataExchangeRowControls
        v-if="decisions.get(row.sourceRow)"
        :row="row"
        :decision="decisions.get(row.sourceRow)!"
        :customers="customers"
        :new-customers="newCustomers"
        :disabled="disabled"
        @change="emit('change', $event)"
        @create-customer="emit('createCustomer', $event)"
      />

      <button
        :ref="(element) => setRowButton(row.sourceRow, element)"
        class="card-detail-toggle"
        type="button"
        :aria-expanded="expandedRows.has(row.sourceRow)"
        :aria-controls="`import-card-detail-${row.sourceRow}`"
        @click="toggle(row.sourceRow)"
      >
        {{ expandedRows.has(row.sourceRow) ? "원본 21열 접기" : "원본 21열 확인" }}
      </button>
      <DataExchangeSourceDetail
        v-if="expandedRows.has(row.sourceRow)"
        :id="`import-card-detail-${row.sourceRow}`"
        :source="row.source"
        :issues="row.issues"
      />
    </article>
  </div>
</template>

<style scoped>
.preview-cards {
  display: none;
  min-width: 0;
  gap: 9px;
}

.preview-cards article {
  display: grid;
  min-width: 0;
  padding: 14px;
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: 9px;
  gap: 12px;
}

.preview-cards article > header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.preview-cards article > header span {
  font-size: 11px;
  font-weight: 750;
}

.preview-cards article > header strong {
  padding: 3px 6px;
  border-radius: 999px;
  font-size: 9px;
}

.preview-cards article > header .is-valid {
  color: var(--success);
  background: var(--success-bg);
}

.preview-cards article > header .is-invalid {
  color: var(--danger);
  background: var(--danger-bg);
}

.card-policy {
  display: grid;
  min-width: 0;
  padding: 10px;
  background: var(--bg-subtle);
  border-radius: 7px;
  gap: 2px;
}

.card-policy strong,
.card-policy span {
  overflow-wrap: anywhere;
}

.card-policy strong {
  font-size: 12px;
}

.card-policy span,
.card-policy small,
.duplicate-note {
  color: var(--text-secondary);
  font-size: 9px;
}

.card-issues {
  display: grid;
  padding: 9px 10px;
  margin: 0;
  color: var(--danger);
  background: var(--danger-bg);
  border-radius: 7px;
  gap: 4px;
  list-style: none;
  font-size: 9px;
}

.duplicate-note {
  margin: 0;
}

.card-detail-toggle {
  width: 100%;
  min-height: 34px;
  color: var(--brand-700);
  background: var(--brand-50);
  border-radius: 6px;
  cursor: pointer;
  font-size: 10px;
  font-weight: 700;
}

@media (max-width: 720px) {
  .preview-cards {
    display: grid;
  }
}
</style>
