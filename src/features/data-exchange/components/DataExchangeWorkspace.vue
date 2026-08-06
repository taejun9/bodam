<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";

import AppButton from "@/shared/components/AppButton.vue";
import AppIcon from "@/shared/components/AppIcon.vue";

import DataExchangeCommitDialog from "./DataExchangeCommitDialog.vue";
import DataExchangeNewCustomerDialog from "./DataExchangeNewCustomerDialog.vue";
import DataExchangePreview from "./DataExchangePreview.vue";
import DataExchangeResultPanel from "./DataExchangeResultPanel.vue";
import type { ImportUiPort } from "./data-exchange-ui";
import { useDataExchangeWorkspace } from "./use-data-exchange-workspace";

const props = defineProps<{
  nativeRuntime: boolean;
  port: ImportUiPort;
  externalBusy?: boolean;
  createClientKey?: (() => string) | undefined;
}>();

const emit = defineEmits<{
  busyChange: [busy: boolean];
  dataChange: [];
}>();

interface PreviewFocusApi {
  focusFirstError: () => void;
  focusRow: (sourceRow: number) => void;
}

const workspaceRoot = ref<HTMLElement>();
const fileErrorElement = ref<HTMLElement>();
const previewComponent = ref<PreviewFocusApi>();

const workspace = useDataExchangeWorkspace(props.port, props.createClientKey);
const {
  preview,
  result,
  decisions,
  newCustomers,
  selecting,
  committing,
  fileError,
  commitError,
  decisionError,
  decisionIssueRow,
  commitOpen,
  customerDialogRow,
  customerDialogSource,
  creatingCount,
  updatingCount,
  skippingCount,
  usedNewCustomerCount,
} = workspace;
const selectorDescription = computed(() => [
  props.nativeRuntime ? "import-file-contract" : "browser-runtime-note",
  props.externalBusy ? "import-operation-note" : null,
].filter(Boolean).join(" "));

watch(
  () => selecting.value || committing.value || commitOpen.value ||
    customerDialogRow.value !== undefined,
  (busy) => emit("busyChange", busy),
  { immediate: true },
);

async function selectFile() {
  if (!props.nativeRuntime || props.externalBusy || selecting.value || committing.value) return;
  const selected = await workspace.selectFile();
  await nextTick();
  if (selected) previewComponent.value?.focusFirstError();
  else if (fileError.value) fileErrorElement.value?.focus();
  else {
    workspaceRoot.value
      ?.querySelector<HTMLElement>("[data-testid='select-import-file']")
      ?.focus();
  }
}

async function requestCommit() {
  if (props.externalBusy) return;
  if (workspace.requestCommit()) return;
  await nextTick();
  if (decisionIssueRow.value !== undefined) {
    previewComponent.value?.focusRow(decisionIssueRow.value);
  }
}

async function commitImport() {
  if (props.externalBusy) return;
  const imported = await workspace.commitImport();
  if (!imported) {
    await nextTick();
    if (fileError.value) fileErrorElement.value?.focus();
    return;
  }
  await nextTick();
  workspaceRoot.value?.querySelector<HTMLElement>("[data-testid='import-result']")?.focus();
  emit("dataChange");
}

async function reset() {
  workspace.resetPreviewState();
  await nextTick();
  workspaceRoot.value
    ?.querySelector<HTMLElement>("[data-testid='select-import-file']")
    ?.focus();
  emit("dataChange");
}
</script>

<template>
  <div
    ref="workspaceRoot"
    class="data-exchange-workspace"
    data-testid="data-exchange-workspace"
    :aria-busy="selecting || committing"
  >
    <section class="import-intro surface" aria-labelledby="contract-import-title">
      <div class="import-intro-copy">
        <span class="intro-icon" aria-hidden="true"><AppIcon name="database" /></span>
        <div>
          <span>Excel / CSV</span>
          <h2 id="contract-import-title">계약조회 파일 가져오기</h2>
          <p>
            승인된 21열 계약조회 양식을 확인한 뒤 선택한 유효 행만 로컬 데이터베이스에 반영합니다.
          </p>
        </div>
      </div>
      <AppButton
        variant="primary"
        :loading="selecting"
        :disabled="!nativeRuntime || externalBusy || committing"
        data-testid="select-import-file"
        :aria-describedby="selectorDescription"
        @click="selectFile"
      >
        {{ preview ? "다른 파일 선택" : "파일 선택" }}
      </AppButton>
    </section>

    <p v-if="!nativeRuntime" id="browser-runtime-note" class="browser-runtime-note" role="status">
      Browser 미리보기에서는 실제 고객 파일을 열지 않습니다. 계약 가져오기는 설치한 BODAM
      데스크톱 앱에서 사용해 주세요.
    </p>

    <p v-if="externalBusy" id="import-operation-note" class="browser-runtime-note" role="status">
      진행 중인 내보내기를 마치면 가져오기를 계속할 수 있습니다.
    </p>

    <section class="privacy-notice" data-testid="data-risk-notice" aria-labelledby="privacy-title">
      <strong id="privacy-title">파일에는 민감한 고객·계약 정보가 포함될 수 있습니다</strong>
      <p>
        선택한 파일은 이 PC에서만 읽고 원본을 수정하거나 보관하지 않습니다. 미리보기 값과 전체
        경로는 로그에 남기지 않으며, 주민등록번호·보험사 로그인 정보·병력 자료가 든 파일은
        가져오지 마세요.
      </p>
    </section>

    <p id="import-file-contract" class="file-contract">
      `.xlsx` 또는 UTF-8 BOM CSV · 최대 10 MiB · 데이터 행 최대 5,000개
    </p>

    <section v-if="selecting" class="import-state surface" aria-live="polite">
      <span class="import-spinner" aria-hidden="true" />
      <strong>파일을 안전하게 확인하고 있습니다</strong>
      <p>sheet, 21개 header, cell 형식과 행별 입력을 검사합니다.</p>
    </section>

    <section
      v-else-if="fileError"
      ref="fileErrorElement"
      class="import-state is-error surface"
      role="alert"
      tabindex="-1"
    >
      <span class="state-symbol is-error" aria-hidden="true">!</span>
      <strong>가져오기를 계속할 수 없습니다</strong>
      <p>{{ fileError }}</p>
      <AppButton
        :disabled="!nativeRuntime || externalBusy"
        :aria-describedby="externalBusy ? 'import-operation-note' : undefined"
        @click="selectFile"
      >
        다시 선택
      </AppButton>
    </section>

    <DataExchangeResultPanel
      v-else-if="result"
      :result="result"
      @reset="reset"
    />

    <template v-else-if="preview">
      <DataExchangePreview
        ref="previewComponent"
        :preview="preview"
        :decisions="decisions"
        :new-customers="newCustomers"
        :disabled="committing || externalBusy"
        @change="workspace.replaceDecision"
        @create-customer="workspace.openCustomerDialog"
      />

      <section class="commit-bar surface" aria-label="가져오기 반영">
        <div>
          <strong>결정을 모두 확인했나요?</strong>
          <p>한 행이라도 실패하면 새 고객과 계약을 포함한 전체 변경을 되돌립니다.</p>
          <p v-if="decisionError" class="decision-error" role="alert">
            {{ decisionError }}
          </p>
        </div>
        <AppButton
          variant="primary"
          :disabled="committing || externalBusy"
          data-testid="commit-import"
          :aria-describedby="externalBusy ? 'import-operation-note' : undefined"
          @click="requestCommit"
        >
          선택 행 반영
        </AppButton>
      </section>
    </template>

    <section v-else class="import-empty surface">
      <span aria-hidden="true"><AppIcon name="database" :size="27" /></span>
      <strong>가져올 파일을 선택해 주세요</strong>
      <p>파일을 읽기만 한 뒤, 데이터베이스에 쓰기 전에 모든 행과 결정을 미리 보여드립니다.</p>
    </section>

    <DataExchangeNewCustomerDialog
      :open="customerDialogRow !== undefined"
      :contractor="customerDialogSource?.contractor ?? null"
      :insured="customerDialogSource?.insured ?? null"
      @close="customerDialogRow = undefined"
      @confirm="workspace.addNewCustomer"
    />

    <DataExchangeCommitDialog
      :open="commitOpen"
      :creating="creatingCount"
      :updating="updatingCount"
      :skipping="skippingCount"
      :new-customers="usedNewCustomerCount"
      :committing="committing"
      :blocked="externalBusy"
      :error="commitError"
      @close="commitOpen = false"
      @confirm="commitImport"
    />
  </div>
</template>

<style scoped src="./data-exchange-workspace.css"></style>
