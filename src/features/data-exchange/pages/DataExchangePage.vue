<script setup lang="ts">
import { nextTick, ref } from "vue";

import {
  contractExportApplication,
  dataExchangeApplication,
} from "@/app/composition/data-exchange";
import ContractExportPanel from "@/features/data-exchange/components/ContractExportPanel.vue";
import DataExchangeWorkspace from "@/features/data-exchange/components/DataExchangeWorkspace.vue";

import { createContractExportPagePort } from "./contract-export-page-adapter";
import { createDataExchangePagePort } from "./data-exchange-page-adapter";

const nativeRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const port = createDataExchangePagePort(dataExchangeApplication);
const exportPort = createContractExportPagePort(contractExportApplication);
const importBusy = ref(false);
const exportBusy = ref(false);
const exportPanel = ref<{ refresh: () => Promise<void> }>();

async function refreshExportSummary() {
  await nextTick();
  await exportPanel.value?.refresh();
}
</script>

<template>
  <section class="data-exchange-page" aria-labelledby="data-exchange-page-title">
    <header class="data-exchange-page-header">
      <div>
        <span>Local data exchange</span>
        <h2 id="data-exchange-page-title">데이터 관리</h2>
        <p>계약 파일을 안전하게 내보내고, 원본을 바꾸지 않은 채 검증해 가져옵니다.</p>
      </div>
    </header>

    <ContractExportPanel
      ref="exportPanel"
      :native-runtime="nativeRuntime"
      :external-busy="importBusy"
      :port="exportPort"
      @busy-change="exportBusy = $event"
    />

    <DataExchangeWorkspace
      :native-runtime="nativeRuntime"
      :external-busy="exportBusy"
      :port="port"
      @busy-change="importBusy = $event"
      @data-change="refreshExportSummary"
    />
  </section>
</template>

<style scoped>
.data-exchange-page {
  display: grid;
  min-width: 0;
  gap: 14px;
}

.data-exchange-page-header {
  margin-bottom: 4px;
}

.data-exchange-page-header span {
  color: var(--brand-700);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.data-exchange-page-header h2 {
  margin: 2px 0 0;
  font-size: 22px;
  letter-spacing: -0.035em;
}

.data-exchange-page-header p {
  margin: 4px 0 0;
  color: var(--text-secondary);
  font-size: 11px;
}

@media (max-width: 640px) {
  .data-exchange-page-header h2 {
    font-size: 19px;
  }
}
</style>
