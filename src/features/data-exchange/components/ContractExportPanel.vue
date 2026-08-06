<script setup lang="ts">
import { computed, nextTick, onMounted, ref, toRef, watch } from "vue";

import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

import type { ContractExportFormat } from "../types/contract-export";
import type { ContractExportUiPort } from "./contract-export-ui";
import { useContractExportPanel } from "./use-contract-export-panel";

const props = defineProps<{
  nativeRuntime: boolean;
  externalBusy: boolean;
  port: ContractExportUiPort;
}>();

const emit = defineEmits<{
  busyChange: [busy: boolean];
}>();

const alertElement = ref<HTMLElement>();
const resultElement = ref<HTMLElement>();
const panelElement = ref<HTMLElement>();
const summaryElement = ref<HTMLElement>();
const cancelledElement = ref<HTMLElement>();
const panel = useContractExportPanel(
  props.port,
  toRef(props, "nativeRuntime"),
  toRef(props, "externalBusy"),
);
const {
  summary,
  result,
  loading,
  saving,
  busy,
  retryDisabled,
  summaryError,
  saveError,
  cancelled,
  lastFormat,
  xlsxDisabled,
  csvDisabled,
} = panel;
const xlsxDescription = computed(() => [
  "export-file-contract",
  "export-security-note",
  !props.nativeRuntime ? "export-runtime-note" : null,
  props.externalBusy ? "export-operation-note" : null,
].filter(Boolean).join(" "));
const csvDescription = computed(() => `${xlsxDescription.value} export-csv-note`);

watch(busy, (value) => emit("busyChange", value), { immediate: true });

onMounted(() => {
  if (props.nativeRuntime) void panel.refreshSummary();
});

async function refresh(focusFailure = false) {
  const refreshed = await panel.refreshSummary();
  if (focusFailure) {
    await nextTick();
    if (!refreshed || summaryError.value) alertElement.value?.focus();
    else if (!focusFormatButton("xlsx")) summaryElement.value?.focus();
  }
}

async function save(format: ContractExportFormat, trigger?: HTMLButtonElement) {
  const outcome = await panel.save(format);
  await nextTick();
  if (outcome === "completed") resultElement.value?.focus();
  if (outcome === "failed") alertElement.value?.focus();
  if (outcome === "cancelled") {
    if (trigger?.isConnected && !trigger.disabled) trigger.focus();
    else if (!focusFormatButton(format)) cancelledElement.value?.focus();
  }
}

function focusFormatButton(format: ContractExportFormat): boolean {
  const button = panelElement.value?.querySelector<HTMLButtonElement>(
    `[data-testid='export-${format}']`,
  );
  if (!button || button.disabled) return false;
  button.focus();
  return true;
}

function handleSave(format: ContractExportFormat, event: MouseEvent) {
  void save(format, event.currentTarget as HTMLButtonElement);
}

function retrySave(event: MouseEvent) {
  if (lastFormat.value) {
    void save(lastFormat.value, event.currentTarget as HTMLButtonElement);
  }
}

defineExpose({ refresh });
</script>

<template>
  <section
    ref="panelElement"
    class="contract-export-panel surface"
    aria-labelledby="contract-export-title"
    :aria-busy="busy"
    data-testid="contract-export-panel"
  >
    <header class="export-header">
      <div class="export-heading">
        <span class="export-icon" aria-hidden="true"><AppIcon name="database" /></span>
        <div>
          <span>Excel / CSV</span>
          <h2 id="contract-export-title">계약조회 파일 내보내기</h2>
          <p>보존된 원본과 현재 계약 값이 같은 활성 계약만 승인된 21열 양식으로 저장합니다.</p>
        </div>
      </div>
      <div class="export-actions" aria-label="내보내기 형식">
        <AppButton
          variant="primary"
          :loading="saving && lastFormat === 'xlsx'"
          :disabled="xlsxDisabled"
          data-testid="export-xlsx"
          :aria-describedby="xlsxDescription"
          @click="handleSave('xlsx', $event)"
        >
          XLSX 저장
        </AppButton>
        <AppButton
          :loading="saving && lastFormat === 'csv'"
          :disabled="csvDisabled"
          data-testid="export-csv"
          :aria-describedby="csvDescription"
          @click="handleSave('csv', $event)"
        >
          CSV 저장
        </AppButton>
      </div>
    </header>

    <p v-if="!nativeRuntime" id="export-runtime-note" class="export-runtime-note" role="status">
      Browser 미리보기에서는 실제 파일을 저장하지 않습니다. 설치한 BODAM 데스크톱 앱에서
      내보내기를 사용해 주세요.
    </p>

    <p v-if="externalBusy" id="export-operation-note" class="export-runtime-note" role="status">
      진행 중인 가져오기 선택 또는 확인을 마치면 내보낼 수 있습니다.
    </p>

    <p id="export-file-contract" class="export-file-contract">
      전체 활성 계약 · 원본과 현재 값이 일치하는 행 · 최대 5,000개 / 10 MiB
    </p>

    <dl ref="summaryElement" class="export-summary" aria-label="내보내기 대상 요약" tabindex="-1">
      <div data-export-summary="exported">
        <dt>내보낼 계약</dt>
        <dd>{{ summary?.exportableCount ?? "—" }}</dd>
      </div>
      <div data-export-summary="missingSource">
        <dt>원본 없음</dt>
        <dd>{{ summary?.missingSourceCount ?? "—" }}</dd>
      </div>
      <div data-export-summary="sourceConflict">
        <dt>원본 불일치</dt>
        <dd>{{ summary?.conflictCount ?? "—" }}</dd>
      </div>
    </dl>

    <p id="export-csv-note" class="export-csv-note" :class="{ 'is-blocked': summary && !summary.csvAllowed }">
      <template v-if="summary && !summary.csvAllowed">
        수식으로 실행될 수 있는 원본 값이 있어 CSV는 차단했습니다. 값을 바꾸지 않는 XLSX를 사용해 주세요.
      </template>
      <template v-else>
        CSV는 UTF-8 BOM과 CRLF를 사용하며, 위험한 수식 시작 값이 발견되면 저장하지 않습니다.
      </template>
    </p>

    <aside id="export-security-note" class="export-security-note">
      <strong>저장 파일은 암호화되지 않은 민감정보 평문입니다</strong>
      <p>
        접근이 제한된 폴더를 선택하고 공유·동기화 폴더를 피하세요. 같은 디스크에 저장한 파일은
        기기 고장에 대비한 백업을 대신하지 않습니다.
      </p>
    </aside>

    <p v-if="loading" class="export-live-state" role="status" aria-live="polite">
      내보낼 계약 건수를 확인하고 있습니다.
    </p>

    <p
      v-else-if="cancelled"
      ref="cancelledElement"
      class="export-live-state"
      role="status"
      aria-live="polite"
      tabindex="-1"
    >
      저장을 취소했습니다. 파일과 데이터베이스는 변경되지 않았습니다.
    </p>

    <section
      v-if="summaryError || saveError"
      ref="alertElement"
      class="export-alert"
      role="alert"
      tabindex="-1"
    >
      <strong>내보내기를 계속할 수 없습니다</strong>
      <p>{{ summaryError ?? saveError }}</p>
      <AppButton v-if="summaryError" :disabled="retryDisabled" @click="refresh(true)">
        건수 다시 불러오기
      </AppButton>
      <AppButton v-else :disabled="retryDisabled" @click="retrySave">
        {{ lastFormat?.toUpperCase() }} 저장 다시 시도
      </AppButton>
    </section>

    <section
      v-if="result"
      ref="resultElement"
      class="export-result"
      data-testid="export-result"
      role="status"
      aria-live="polite"
      tabindex="-1"
    >
      <div>
        <strong>계약 파일을 저장했습니다</strong>
        <p><span>{{ result.format.toUpperCase() }}</span> · {{ result.basename }}</p>
      </div>
      <dl>
        <div data-export-count="exported"><dt>저장</dt><dd>{{ result.exportedCount }}</dd></div>
        <div data-export-count="missingSource"><dt>원본 없음</dt><dd>{{ result.missingSourceCount }}</dd></div>
        <div data-export-count="sourceConflict"><dt>원본 불일치</dt><dd>{{ result.conflictCount }}</dd></div>
      </dl>
    </section>
  </section>
</template>

<style scoped src="./contract-export-panel.css"></style>
