import type {
  ImportCommitDraft,
  ImportCommitResult,
} from "../types/import-commit";
import type { ContractImportPreview } from "../types/import-preview";
import type {
  ImportCommitOperation,
  ImportPreviewOperation,
} from "../application/data-exchange-application";
import { DataExchangeError } from "../types/data-exchange-error";
import type {
  ImportUiCommitRequest,
  ImportUiPort,
  ImportUiPreview,
  ImportUiResult,
} from "../components/data-exchange-ui";

export interface DataExchangePageApplication {
  chooseFile(): Promise<ImportPreviewOperation>;
  commit(input: ImportCommitDraft): Promise<ImportCommitOperation>;
  clear(): void;
}

export function createDataExchangePagePort(
  application: DataExchangePageApplication,
): ImportUiPort {
  return {
    async selectFile() {
      const operation = await application.chooseFile();
      return operation.status === "ready" ? toUiPreview(operation.preview) : null;
    },
    async commitImport(request) {
      const operation = await application.commit(toCommitDraft(request));
      if (operation.status !== "completed") {
        throw new DataExchangeError("가져오기 작업이 취소되었습니다.", "operation_failed");
      }
      return toUiResult(operation.result);
    },
    clear: () => application.clear(),
  };
}

function toUiPreview(preview: ContractImportPreview): ImportUiPreview {
  const customerNames = new Map(preview.customers.map((customer) => [
    customer.id,
    customer.name,
  ]));
  return {
    previewId: preview.previewId,
    fileName: preview.basename,
    format: preview.format,
    issues: [],
    customers: preview.customers,
    rows: preview.rows.map((row) => ({
      sourceRow: row.source.sourceRow,
      source: row.source.cells,
      mapped: row.mapped,
      issues: row.issues.map((issue) => ({
        ...issue,
        sourceRow: issue.sourceRow,
      })),
      duplicateCandidates: row.duplicateCandidates.map((candidate) => ({
        policyId: candidate.policyId,
        customerName: customerNames.get(candidate.customerId) ?? "기존 고객",
        insurer: candidate.insurer,
        productName: candidate.productName,
      })),
      batchDuplicateOf: row.batchDuplicateOf,
      defaultDecision: row.defaultDecision,
    })),
  };
}

function toCommitDraft(request: ImportUiCommitRequest): ImportCommitDraft {
  return {
    previewId: request.previewId,
    newCustomers: request.newCustomers,
    rows: request.rows.filter((row) => row.selected).map((row) => {
      if (row.duplicateAction === "skip") {
        return { sourceRow: row.sourceRow, decision: { action: "skip" as const } };
      }
      if (row.duplicateAction === "update") {
        if (!row.duplicateTargetPolicyId) throw new Error("update target unavailable");
        return {
          sourceRow: row.sourceRow,
          decision: {
            action: "update" as const,
            targetPolicyId: row.duplicateTargetPolicyId,
          },
        };
      }
      if (!row.customer) throw new Error("customer unavailable");
      return {
        sourceRow: row.sourceRow,
        decision: {
          action: row.duplicateAction === "separate-create"
            ? "separateCreate" as const
            : "create" as const,
          customer: row.customer,
        },
      };
    }),
  };
}

function toUiResult(result: ImportCommitResult): ImportUiResult {
  return {
    createdCount: result.created,
    updatedCount: result.updated,
    skippedCount: result.skipped,
    unselectedCount: result.unselectedRows,
    invalidCount: result.invalidRows,
    outcomes: result.outcomes,
  };
}
