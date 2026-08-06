<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import type {
  ImportSourceKey,
  ImportUiPreview,
  ImportUiRowDecision,
  NewCustomerDefinition,
} from "./data-exchange-ui";
import { IMPORT_SOURCE_FIELDS, rowCanWrite } from "./data-exchange-ui";
import DataExchangePreviewCards from "./DataExchangePreviewCards.vue";
import DataExchangePreviewTable from "./DataExchangePreviewTable.vue";

const props = defineProps<{
  preview: ImportUiPreview;
  decisions: ReadonlyMap<number, ImportUiRowDecision>;
  newCustomers: readonly NewCustomerDefinition[];
  disabled: boolean;
}>();

const emit = defineEmits<{
  change: [decision: ImportUiRowDecision];
  createCustomer: [sourceRow: number];
}>();

interface FocusablePreview {
  focusRow: (sourceRow: number) => void;
}

const table = ref<FocusablePreview>();
const cards = ref<FocusablePreview>();
const errorSummary = ref<HTMLElement>();
const previewRoot = ref<HTMLElement>();
const page = ref(0);
const pageSize = 50;

const validCount = computed(() =>
  props.preview.rows.filter((row) => row.issues.length === 0 && row.mapped).length,
);
const invalidCount = computed(() => props.preview.rows.length - validCount.value);
const duplicateCount = computed(() =>
  props.preview.rows.filter((row) =>
    row.duplicateCandidates.length > 0 || row.batchDuplicateOf !== null).length,
);
const selectedCount = computed(() =>
  [...props.decisions.values()].filter((decision) => decision.selected).length,
);
const writeCount = computed(() =>
  [...props.decisions.values()].filter(rowCanWrite).length,
);
const rowIssues = computed(() => props.preview.rows.flatMap((row) => row.issues));
const allIssues = computed(() => [...props.preview.issues, ...rowIssues.value]);
const visibleIssues = computed(() => allIssues.value.slice(0, 100));
const hiddenIssueCount = computed(() => Math.max(0, allIssues.value.length - 100));
const pageCount = computed(() => Math.max(1, Math.ceil(props.preview.rows.length / pageSize)));
const visibleRows = computed(() => props.preview.rows.slice(
  page.value * pageSize,
  (page.value + 1) * pageSize,
));
const fieldLabels = new Map<ImportSourceKey | "row" | "file", string>([
  ...IMPORT_SOURCE_FIELDS,
  ["row", "행"],
  ["file", "파일"],
]);

async function moveToRow(sourceRow: number) {
  const rowIndex = props.preview.rows.findIndex((row) => row.sourceRow === sourceRow);
  if (rowIndex >= 0) page.value = Math.floor(rowIndex / pageSize);
  await nextTick();
}

async function focusIssue(sourceRow: number | null) {
  if (sourceRow === null) {
    errorSummary.value?.focus();
    return;
  }
  await moveToRow(sourceRow);
  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches;
  (mobile ? cards.value : table.value)?.focusRow(sourceRow);
}

function focusFirstError() {
  if (allIssues.value.length > 0) errorSummary.value?.focus();
  else previewRoot.value?.focus();
}

async function focusRow(sourceRow: number) {
  await moveToRow(sourceRow);
  const mobile = typeof window !== "undefined" && window.matchMedia?.("(max-width: 720px)").matches;
  const view = mobile ? "import-preview-cards" : "import-preview-table";
  const row = previewRoot.value?.querySelector<HTMLElement>(
    `[data-testid='${view}'] [data-source-row='${sourceRow}']`,
  );
  row?.querySelector<HTMLElement>("[aria-invalid='true'], select, button")?.focus();
}

watch(() => props.preview.previewId, () => {
  page.value = 0;
});

defineExpose({ focusFirstError, focusRow });
</script>

<template>
  <section
    ref="previewRoot"
    class="import-preview"
    data-testid="import-preview"
    aria-labelledby="preview-title"
    tabindex="-1"
  >
    <header class="preview-header">
      <div>
        <span>{{ preview.format.toUpperCase() }} 파일</span>
        <h3 id="preview-title">{{ preview.fileName }}</h3>
        <p>원본 파일은 수정하거나 앱 내부에 복사하지 않습니다.</p>
      </div>
      <dl class="preview-counts" aria-label="가져오기 행 요약">
        <div><dt>전체</dt><dd>{{ preview.rows.length }}</dd></div>
        <div><dt>유효</dt><dd>{{ validCount }}</dd></div>
        <div><dt>오류</dt><dd>{{ invalidCount }}</dd></div>
        <div><dt>중복 후보</dt><dd>{{ duplicateCount }}</dd></div>
        <div><dt>선택</dt><dd>{{ selectedCount }}</dd></div>
      </dl>
    </header>

    <section
      v-if="allIssues.length"
      ref="errorSummary"
      class="preview-errors"
      role="alert"
      tabindex="-1"
      aria-labelledby="preview-errors-title"
    >
      <strong id="preview-errors-title">반영할 수 없는 항목을 확인해 주세요</strong>
      <ul>
        <li
          v-for="(issue, index) in visibleIssues"
          :key="`${issue.sourceRow}:${issue.field}:${issue.code}:${index}`"
        >
          <button type="button" @click="focusIssue(issue.sourceRow)">
            {{ issue.sourceRow ? `${issue.sourceRow}행` : "파일" }} ·
            {{ fieldLabels.get(issue.field) ?? issue.field }} — {{ issue.message }}
          </button>
        </li>
      </ul>
      <small v-if="hiddenIssueCount">
        같은 형식의 오류 {{ hiddenIssueCount }}건은 행 페이지에서 계속 확인할 수 있습니다.
      </small>
    </section>

    <p class="decision-help">
      유효한 행만 선택할 수 있습니다. 새 계약은 연결 고객을 직접 정하고, 중복 후보는
      건너뛰기·기존 계약 갱신·별도 계약 생성을 선택하세요.
    </p>

    <div v-if="newCustomers.length" class="new-customer-summary" role="status">
      <strong>이번 가져오기에 만들 고객 {{ newCustomers.length }}명</strong>
      <span
        v-for="customer in newCustomers"
        :key="customer.clientKey"
        class="new-customer-name"
      >
        {{ customer.name }}
      </span>
    </div>

    <DataExchangePreviewTable
      ref="table"
      :rows="visibleRows"
      :decisions="decisions"
      :customers="preview.customers"
      :new-customers="newCustomers"
      :disabled="disabled"
      @change="emit('change', $event)"
      @create-customer="emit('createCustomer', $event)"
    />
    <DataExchangePreviewCards
      ref="cards"
      :rows="visibleRows"
      :decisions="decisions"
      :customers="preview.customers"
      :new-customers="newCustomers"
      :disabled="disabled"
      @change="emit('change', $event)"
      @create-customer="emit('createCustomer', $event)"
    />

    <nav v-if="pageCount > 1" class="preview-pagination" aria-label="가져오기 행 페이지">
      <button type="button" :disabled="page === 0" @click="page -= 1">이전</button>
      <span>{{ page + 1 }} / {{ pageCount }} 페이지</span>
      <button type="button" :disabled="page + 1 >= pageCount" @click="page += 1">다음</button>
    </nav>

    <p class="preview-selection-status" role="status">
      선택 {{ selectedCount }}행 · 실제 생성 또는 갱신 {{ writeCount }}행
    </p>
  </section>
</template>

<style scoped src="./data-exchange-preview.css"></style>
