import { computed, onBeforeUnmount, ref } from "vue";

import type {
  ImportUiCommitRequest,
  ImportUiPort,
  ImportUiPreview,
  ImportUiResult,
  ImportUiRowDecision,
  NewCustomerDefinition,
} from "./data-exchange-ui";
import { rowCanWrite, rowNeedsCustomer } from "./data-exchange-ui";

const GENERIC_FILE_ERROR =
  "파일을 열지 못했습니다. 형식과 크기를 확인한 뒤 다시 선택해 주세요.";
const GENERIC_COMMIT_ERROR =
  "계약을 반영하지 못했습니다. 새 미리보기에서 상태를 다시 확인해 주세요.";

function safeMessage(error: unknown, fallback: string): string {
  if (
    error instanceof Error &&
    [
      "DataExchangeApplicationError",
      "DataExchangeError",
      "DataExchangeRepositoryError",
      "DataExchangeValidationError",
    ].includes(error.name) &&
    error.message.trim()
  ) {
    return error.message;
  }
  return fallback;
}

function errorCode(error: unknown): string | undefined {
  if (typeof error !== "object" || error === null || !("code" in error)) return undefined;
  return typeof (error as { code?: unknown }).code === "string"
    ? (error as { code: string }).code
    : undefined;
}

function initialDecision(previewRow: ImportUiPreview["rows"][number]): ImportUiRowDecision {
  const valid = previewRow.mapped !== null && previewRow.issues.length === 0;
  return {
    sourceRow: previewRow.sourceRow,
    selected: valid,
    customer: null,
    duplicateAction: previewRow.defaultDecision === "skip" ? "skip" : "create",
    duplicateTargetPolicyId: null,
  };
}

export function useDataExchangeWorkspace(
  port: ImportUiPort,
  createClientKey: () => string = () => globalThis.crypto.randomUUID(),
) {
  const preview = ref<ImportUiPreview>();
  const result = ref<ImportUiResult>();
  const decisions = ref(new Map<number, ImportUiRowDecision>());
  const newCustomers = ref<NewCustomerDefinition[]>([]);
  const selecting = ref(false);
  const committing = ref(false);
  const fileError = ref<string>();
  const commitError = ref<string>();
  const decisionError = ref<string>();
  const decisionIssueRow = ref<number>();
  const commitOpen = ref(false);
  const customerDialogRow = ref<number>();
  let requestNumber = 0;

  const selectedDecisions = computed(() =>
    [...decisions.value.values()].filter((decision) => decision.selected),
  );
  const creatingCount = computed(() => selectedDecisions.value.filter((decision) =>
    decision.duplicateAction === "create" ||
    decision.duplicateAction === "separate-create").length,
  );
  const updatingCount = computed(() => selectedDecisions.value.filter((decision) =>
    decision.duplicateAction === "update").length,
  );
  const skippingCount = computed(() => selectedDecisions.value.filter((decision) =>
    decision.duplicateAction === "skip").length,
  );
  const usedNewCustomerCount = computed(() => {
    const keys = new Set(selectedDecisions.value.flatMap((decision) =>
      rowCanWrite(decision) && decision.customer?.kind === "new"
        ? [decision.customer.clientKey]
        : [],
    ));
    return newCustomers.value.filter((customer) => keys.has(customer.clientKey)).length;
  });
  const customerDialogSource = computed(() => preview.value?.rows.find(
    (row) => row.sourceRow === customerDialogRow.value,
  )?.source);

  function replaceDecision(decision: ImportUiRowDecision) {
    const next = new Map(decisions.value);
    next.set(decision.sourceRow, decision);
    decisions.value = next;
    decisionError.value = undefined;
    decisionIssueRow.value = undefined;
  }

  function resetPreviewState() {
    preview.value = undefined;
    result.value = undefined;
    decisions.value = new Map();
    newCustomers.value = [];
    fileError.value = undefined;
    commitError.value = undefined;
    decisionError.value = undefined;
    decisionIssueRow.value = undefined;
    commitOpen.value = false;
    customerDialogRow.value = undefined;
  }

  async function selectFile(): Promise<ImportUiPreview | undefined> {
    const currentRequest = ++requestNumber;
    selecting.value = true;
    fileError.value = undefined;
    try {
      const selected = await port.selectFile();
      if (currentRequest !== requestNumber || selected === null) return undefined;
      result.value = undefined;
      preview.value = selected;
      decisions.value = new Map(selected.rows.map((row) => [
        row.sourceRow,
        initialDecision(row),
      ]));
      newCustomers.value = [];
      commitError.value = undefined;
      decisionError.value = undefined;
      return selected;
    } catch (error) {
      if (currentRequest === requestNumber) {
        fileError.value = safeMessage(error, GENERIC_FILE_ERROR);
      }
      return undefined;
    } finally {
      if (currentRequest === requestNumber) selecting.value = false;
    }
  }

  function openCustomerDialog(sourceRow: number) {
    customerDialogRow.value = sourceRow;
  }

  function addNewCustomer(name: string) {
    const sourceRow = customerDialogRow.value;
    if (sourceRow === undefined) return;
    const definition: NewCustomerDefinition = {
      clientKey: createClientKey(),
      name,
    };
    newCustomers.value = [...newCustomers.value, definition];
    const decision = decisions.value.get(sourceRow);
    if (decision) {
      replaceDecision({
        ...decision,
        customer: { kind: "new", clientKey: definition.clientKey },
      });
    }
    customerDialogRow.value = undefined;
  }

  function firstIncompleteDecision(): number | undefined {
    for (const decision of decisions.value.values()) {
      if (!decision.selected) continue;
      if (rowNeedsCustomer(decision) && !decision.customer) return decision.sourceRow;
      if (decision.duplicateAction === "update" && !decision.duplicateTargetPolicyId) {
        return decision.sourceRow;
      }
    }
    return undefined;
  }

  function requestCommit(): boolean {
    const incomplete = firstIncompleteDecision();
    if (incomplete !== undefined) {
      decisionIssueRow.value = incomplete;
      decisionError.value = `${incomplete}행의 고객 또는 중복 처리 결정을 완료해 주세요.`;
      return false;
    }
    if (![...decisions.value.values()].some(rowCanWrite)) {
      decisionError.value = "생성하거나 갱신할 행을 한 개 이상 선택해 주세요.";
      return false;
    }
    commitError.value = undefined;
    commitOpen.value = true;
    return true;
  }

  function commitRequest(): ImportUiCommitRequest {
    const currentPreview = preview.value;
    if (!currentPreview) throw new Error("preview unavailable");
    const rows = currentPreview.rows.flatMap((row) => {
      const decision = decisions.value.get(row.sourceRow);
      if (!decision || !row.mapped || row.issues.length > 0) return [];
      return [{
        ...decision,
        source: row.source,
        mapped: row.mapped,
        duplicateSnapshotPolicyIds: row.duplicateCandidates.map((item) => item.policyId),
      }];
    });
    const referencedKeys = new Set(rows.flatMap((row) =>
      row.selected && rowCanWrite(row) && row.customer?.kind === "new"
        ? [row.customer.clientKey]
        : [],
    ));
    return {
      previewId: currentPreview.previewId,
      fileName: currentPreview.fileName,
      format: currentPreview.format,
      rows,
      newCustomers: newCustomers.value.filter((item) => referencedKeys.has(item.clientKey)),
    };
  }

  async function commitImport(): Promise<ImportUiResult | undefined> {
    committing.value = true;
    commitError.value = undefined;
    try {
      const imported = await port.commitImport(commitRequest());
      result.value = imported;
      preview.value = undefined;
      decisions.value = new Map();
      newCustomers.value = [];
      commitOpen.value = false;
      return imported;
    } catch (error) {
      const message = safeMessage(error, GENERIC_COMMIT_ERROR);
      if (errorCode(error) === "conflict") {
        preview.value = undefined;
        decisions.value = new Map();
        newCustomers.value = [];
        commitOpen.value = false;
        fileError.value = message;
      } else {
        commitError.value = message;
      }
      return undefined;
    } finally {
      committing.value = false;
    }
  }

  onBeforeUnmount(() => {
    requestNumber += 1;
    port.clear?.();
  });

  return {
    preview, result, decisions, newCustomers, selecting, committing,
    fileError, commitError, decisionError, decisionIssueRow, commitOpen,
    customerDialogRow, customerDialogSource, creatingCount, updatingCount, skippingCount,
    usedNewCustomerCount,
    replaceDecision, resetPreviewState, selectFile, openCustomerDialog,
    addNewCustomer, requestCommit, commitImport,
  };
}
