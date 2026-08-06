<script setup lang="ts">
import { dataExchangeApplication } from "@/app/composition/data-exchange";
import DataExchangeWorkspace from "@/features/data-exchange/components/DataExchangeWorkspace.vue";

import { createDataExchangePagePort } from "./data-exchange-page-adapter";

const nativeRuntime = typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
const port = createDataExchangePagePort(dataExchangeApplication);
</script>

<template>
  <section class="data-exchange-page" aria-labelledby="data-exchange-page-title">
    <header class="data-exchange-page-header">
      <div>
        <span>Local data exchange</span>
        <h2 id="data-exchange-page-title">데이터 관리</h2>
        <p>원본 파일을 바꾸지 않고 계약 행을 검증한 뒤 명시적으로 반영합니다.</p>
      </div>
    </header>

    <DataExchangeWorkspace :native-runtime="nativeRuntime" :port="port" />
  </section>
</template>

<style scoped>
.data-exchange-page {
  min-width: 0;
}

.data-exchange-page-header {
  margin-bottom: 18px;
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
