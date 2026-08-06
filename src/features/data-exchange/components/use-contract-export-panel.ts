import {
  computed,
  onBeforeUnmount,
  ref,
  toValue,
  type MaybeRefOrGetter,
} from "vue";

import type { ContractExportFormat } from "../types/contract-export";
import { ContractExportError } from "../types/contract-export-error";
import type {
  ContractExportUiPort,
  ContractExportUiResult,
  ContractExportUiSummary,
} from "./contract-export-ui";

const SUMMARY_ERROR =
  "내보낼 계약 건수를 불러오지 못했습니다. 다시 시도해 주세요.";
const SAVE_ERROR =
  "계약 파일을 저장하지 못했습니다. 다시 시도해 주세요.";

function safeMessage(error: unknown, fallback: string): string {
  if (error instanceof ContractExportError && error.message.trim()) {
    return error.message;
  }
  return fallback;
}

export function useContractExportPanel(
  port: ContractExportUiPort,
  nativeRuntime: MaybeRefOrGetter<boolean>,
  externalBusy: MaybeRefOrGetter<boolean>,
) {
  const summary = ref<ContractExportUiSummary>();
  const result = ref<ContractExportUiResult>();
  const loading = ref(false);
  const saving = ref(false);
  const summaryError = ref<string>();
  const saveError = ref<string>();
  const cancelled = ref(false);
  const lastFormat = ref<ContractExportFormat>();
  let requestNumber = 0;

  const busy = computed(() => loading.value || saving.value);
  const retryDisabled = computed(() =>
    !toValue(nativeRuntime) || toValue(externalBusy) || busy.value,
  );
  const baseDisabled = computed(() =>
    !toValue(nativeRuntime) || toValue(externalBusy) || busy.value ||
    Boolean(summaryError.value) || !summary.value || summary.value.exportableCount === 0,
  );
  const xlsxDisabled = computed(() => baseDisabled.value);
  const csvDisabled = computed(() =>
    baseDisabled.value || summary.value?.csvAllowed !== true,
  );

  async function refreshSummary(allowWhileSaving = false): Promise<boolean> {
    if (!toValue(nativeRuntime) || toValue(externalBusy) || loading.value ||
      (saving.value && !allowWhileSaving)) {
      return false;
    }
    const request = ++requestNumber;
    loading.value = true;
    summaryError.value = undefined;
    try {
      const operation = await port.loadSummary();
      if (request !== requestNumber || operation.status === "stale") return false;
      summary.value = operation.summary;
      return true;
    } catch (error: unknown) {
      if (request === requestNumber) {
        summary.value = undefined;
        summaryError.value = safeMessage(error, SUMMARY_ERROR);
      }
      return false;
    } finally {
      if (request === requestNumber) loading.value = false;
    }
  }

  async function save(format: ContractExportFormat): Promise<"completed" | "cancelled" | "failed" | "stale"> {
    const disabled = format === "csv" ? csvDisabled.value : xlsxDisabled.value;
    if (disabled) return "stale";
    const request = ++requestNumber;
    saving.value = true;
    saveError.value = undefined;
    cancelled.value = false;
    result.value = undefined;
    lastFormat.value = format;
    try {
      const operation = await port.save(format);
      if (request !== requestNumber || operation.status === "stale") return "stale";
      if (operation.status === "cancelled") {
        cancelled.value = true;
        return "cancelled";
      }
      result.value = operation.result;
      await refreshSummary(true);
      return "completed";
    } catch (error: unknown) {
      if (request === requestNumber) saveError.value = safeMessage(error, SAVE_ERROR);
      return "failed";
    } finally {
      saving.value = false;
    }
  }

  onBeforeUnmount(() => {
    requestNumber += 1;
    port.clear?.();
  });

  return {
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
    refreshSummary,
    save,
  };
}
