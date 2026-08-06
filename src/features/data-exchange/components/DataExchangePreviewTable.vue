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

function detailId(sourceRow: number): string {
  return `import-source-detail-${sourceRow}`;
}

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
  <div class="preview-table-wrap" data-testid="import-preview-table">
    <table class="preview-table">
      <caption class="sr-only">가져올 계약 행 미리보기</caption>
      <thead>
        <tr>
          <th scope="col">원본 행</th>
          <th scope="col">검증</th>
          <th scope="col">계약 요약</th>
          <th scope="col">반영 결정</th>
          <th scope="col">원본 21열</th>
        </tr>
      </thead>
      <tbody>
        <template v-for="row in rows" :key="row.sourceRow">
          <tr
            data-testid="import-row"
            :data-source-row="row.sourceRow"
            :data-row-state="row.issues.length ? 'invalid' : 'valid'"
            :data-duplicate-state="row.duplicateCandidates.length || row.batchDuplicateOf !== null ? 'duplicate' : 'new'"
          >
            <th scope="row">{{ row.sourceRow }}행</th>
            <td>
              <span
                class="row-state"
                :class="row.issues.length ? 'is-invalid' : 'is-valid'"
              >
                {{ row.issues.length ? `오류 ${row.issues.length}건` : "사용 가능" }}
              </span>
              <ul v-if="row.issues.length" class="row-issues">
                <li v-for="issue in row.issues" :key="`${issue.field}:${issue.code}`">
                  {{ issue.message }}
                </li>
              </ul>
              <small
                v-else-if="row.duplicateCandidates.length || row.batchDuplicateOf !== null"
                class="duplicate-note"
              >
                {{ row.batchDuplicateOf
                  ? `${row.batchDuplicateOf}행과 파일 내 중복`
                  : `중복 후보 ${row.duplicateCandidates.length}건` }}
              </small>
            </td>
            <td>
              <div v-if="row.mapped" class="policy-summary">
                <strong>{{ row.mapped.productName }}</strong>
                <span>{{ row.mapped.insurer }}</span>
                <small>{{ row.mapped.monthlyPremiumWon }}원</small>
              </div>
              <span v-else class="unavailable-value">mapping 불가</span>
            </td>
            <td>
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
            </td>
            <td>
              <button
                :ref="(element) => setRowButton(row.sourceRow, element)"
                class="detail-toggle"
                type="button"
                :aria-expanded="expandedRows.has(row.sourceRow)"
                :aria-controls="detailId(row.sourceRow)"
                @click="toggle(row.sourceRow)"
              >
                {{ expandedRows.has(row.sourceRow) ? "접기" : "21열 확인" }}
              </button>
            </td>
          </tr>
          <tr v-if="expandedRows.has(row.sourceRow)" class="detail-row">
            <td :id="detailId(row.sourceRow)" colspan="5">
              <DataExchangeSourceDetail :source="row.source" :issues="row.issues" />
            </td>
          </tr>
        </template>
      </tbody>
    </table>
  </div>
</template>

<style scoped>
.preview-table-wrap {
  width: 100%;
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 9px;
  overflow-x: auto;
}

.preview-table {
  width: 100%;
  min-width: 980px;
  border-collapse: collapse;
  table-layout: fixed;
}

.preview-table th,
.preview-table td {
  padding: 11px 12px;
  border-bottom: 1px solid var(--border);
  font-size: 10px;
  text-align: left;
  vertical-align: top;
}

.preview-table thead th {
  color: var(--text-secondary);
  background: var(--bg-subtle);
  font-size: 9px;
}

.preview-table thead th:first-child { width: 8%; }
.preview-table thead th:nth-child(2) { width: 15%; }
.preview-table thead th:nth-child(3) { width: 20%; }
.preview-table thead th:nth-child(4) { width: 47%; }
.preview-table thead th:last-child { width: 10%; }

.preview-table tbody > tr:last-child > td,
.preview-table tbody > tr:last-child > th {
  border-bottom: 0;
}

.row-state {
  display: inline-flex;
  padding: 3px 6px;
  border-radius: 999px;
  font-size: 9px;
  font-weight: 750;
}

.row-state.is-valid {
  color: var(--success);
  background: var(--success-bg);
}

.row-state.is-invalid {
  color: var(--danger);
  background: var(--danger-bg);
}

.row-issues {
  display: grid;
  padding: 0;
  margin: 7px 0 0;
  color: var(--danger);
  gap: 4px;
  list-style: none;
}

.duplicate-note,
.policy-summary span,
.policy-summary small,
.unavailable-value {
  display: block;
  margin-top: 4px;
  color: var(--text-secondary);
  overflow-wrap: anywhere;
  font-size: 9px;
}

.policy-summary {
  min-width: 0;
}

.policy-summary strong {
  display: block;
  overflow-wrap: anywhere;
  font-size: 11px;
}

.detail-toggle {
  padding: 5px 7px;
  color: var(--brand-700);
  background: transparent;
  border-radius: 5px;
  cursor: pointer;
  font-size: 9px;
  font-weight: 700;
}

.detail-toggle:hover,
.detail-toggle:focus-visible {
  background: var(--brand-50);
}

.detail-row > td {
  padding: 10px 12px 14px;
  background: var(--bg-subtle);
}

@media (max-width: 720px) {
  .preview-table-wrap {
    display: none;
  }
}
</style>
