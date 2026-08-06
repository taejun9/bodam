import { parseImportCommitDraft } from "../schemas/import-commit-schema";
import type {
  ImportCommitDraft,
  ImportCommitRequest,
  ImportCommitResult,
  ImportCustomerReference,
  ImportRowDecision,
} from "../types/import-commit";
import {
  DataExchangeRepositoryError,
  DataExchangeValidationError,
  type DataExchangeValidationIssue,
} from "../types/data-exchange-error";
import type {
  ContractImportPreview,
  ImportPreviewRow,
} from "../types/import-preview";

export function buildImportCommitRequest(
  preview: ContractImportPreview,
  input: unknown,
): ImportCommitRequest {
  const draft = parseImportCommitDraft(input);
  const issues: DataExchangeValidationIssue[] = [];
  if (draft.previewId !== preview.previewId) {
    issues.push({ field: "previewId", message: "현재 미리보기와 일치하지 않습니다." });
  }

  const customers = new Set(preview.customers.map(({ id }) => id));
  const definitions = new Map(draft.newCustomers.map((customer) => [customer.clientKey, customer]));
  const previewRows = new Map(preview.rows.map((row) => [row.source.sourceRow, row]));
  const usedClientKeys = new Set<string>();
  const updateTargets = new Set<string>();
  let writeCount = 0;

  const selectedRows = draft.rows.map((selection, index) => {
    const row = previewRows.get(selection.sourceRow);
    if (row === undefined || row.issues.length > 0 || row.mapped === null) {
      issues.push({ field: `rows.${index}`, message: "선택할 수 없는 행입니다." });
      return null;
    }
    validateDecision(
      row,
      selection.decision,
      customers,
      definitions,
      usedClientKeys,
      updateTargets,
      `rows.${index}.decision`,
      issues,
    );
    if (selection.decision.action !== "skip") writeCount += 1;
    return {
      source: row.source,
      mapped: row.mapped,
      decision: selection.decision,
    };
  });

  if (writeCount === 0) {
    issues.push({ field: "rows", message: "반영할 생성 또는 수정 행을 하나 이상 선택해 주세요." });
  }
  if (issues.length > 0) throw new DataExchangeValidationError(issues);

  const rows = selectedRows
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort((left, right) => left.source.sourceRow - right.source.sourceRow);
  const invalidRows = preview.rows.filter((row) => row.issues.length > 0).length;
  const validRows = preview.rows.length - invalidRows;

  return {
    previewId: preview.previewId,
    snapshotToken: preview.snapshotToken,
    format: preview.format,
    newCustomers: draft.newCustomers
      .filter(({ clientKey }) => usedClientKeys.has(clientKey))
      .sort((left, right) => compareText(left.clientKey, right.clientKey)),
    rows,
    summary: {
      totalRows: preview.rows.length,
      invalidRows,
      unselectedRows: validRows - rows.length,
    },
  };
}

export function validateImportCommitResult(
  result: ImportCommitResult,
  request: ImportCommitRequest,
): ImportCommitResult {
  const expected = new Map(request.rows.map((row) => [
    row.source.sourceRow,
    expectedOutcome(row.decision),
  ]));
  const seen = new Set<number>();
  let previous = 1;

  const validOutcomes = result.outcomes.every((outcome) => {
    const expectedKind = expected.get(outcome.sourceRow);
    const valid = expectedKind === outcome.outcome &&
      !seen.has(outcome.sourceRow) && outcome.sourceRow > previous &&
      (outcome.outcome === "skipped" ? outcome.policyId === null : outcome.policyId !== null);
    seen.add(outcome.sourceRow);
    previous = outcome.sourceRow;
    return valid;
  });
  const created = result.outcomes.filter(({ outcome }) => outcome === "created").length;
  const updated = result.outcomes.filter(({ outcome }) => outcome === "updated").length;
  const skipped = result.outcomes.filter(({ outcome }) => outcome === "skipped").length;
  const total = result.created + result.updated + result.skipped +
    result.unselectedRows + result.invalidRows;

  if (
    !validOutcomes || seen.size !== expected.size ||
    result.created !== created || result.updated !== updated || result.skipped !== skipped ||
    result.totalRows !== request.summary.totalRows ||
    result.invalidRows !== request.summary.invalidRows ||
    result.unselectedRows !== request.summary.unselectedRows ||
    total !== result.totalRows
  ) {
    throw new DataExchangeRepositoryError(
      "가져오기 반영 결과를 확인할 수 없습니다.",
      "invalid_response",
    );
  }
  return result;
}

function validateDecision(
  row: ImportPreviewRow,
  decision: ImportRowDecision,
  customerIds: ReadonlySet<string>,
  definitions: ReadonlyMap<string, ImportCommitDraft["newCustomers"][number]>,
  usedClientKeys: Set<string>,
  updateTargets: Set<string>,
  field: string,
  issues: DataExchangeValidationIssue[],
): void {
  const hasDuplicate = row.duplicateCandidates.length > 0 || row.batchDuplicateOf !== null;
  if (decision.action === "create" && hasDuplicate) {
    issues.push({ field, message: "중복 행은 별도 생성으로 명시해 주세요." });
  } else if (decision.action === "separateCreate" && !hasDuplicate) {
    issues.push({ field, message: "중복이 아닌 행은 일반 생성으로 선택해 주세요." });
  } else if (decision.action === "update") {
    const matches = row.duplicateCandidates.some(({ policyId }) =>
      policyId === decision.targetPolicyId
    );
    if (!matches) issues.push({ field, message: "수정할 중복 계약을 다시 선택해 주세요." });
    if (updateTargets.has(decision.targetPolicyId)) {
      issues.push({ field, message: "같은 기존 계약은 한 번만 갱신할 수 있습니다." });
    }
    updateTargets.add(decision.targetPolicyId);
  }

  if (decision.action === "create" || decision.action === "separateCreate") {
    validateCustomer(decision.customer, customerIds, definitions, usedClientKeys, field, issues);
  }
}

function validateCustomer(
  customer: ImportCustomerReference,
  customerIds: ReadonlySet<string>,
  definitions: ReadonlyMap<string, ImportCommitDraft["newCustomers"][number]>,
  usedClientKeys: Set<string>,
  field: string,
  issues: DataExchangeValidationIssue[],
): void {
  if (customer.kind === "existing" && !customerIds.has(customer.customerId)) {
    issues.push({ field, message: "활성 고객을 다시 선택해 주세요." });
  }
  if (customer.kind === "new") {
    if (!definitions.has(customer.clientKey)) {
      issues.push({ field, message: "새 고객 이름을 확인해 주세요." });
    } else {
      usedClientKeys.add(customer.clientKey);
    }
  }
}

function expectedOutcome(decision: ImportRowDecision): "created" | "updated" | "skipped" {
  if (decision.action === "update") return "updated";
  if (decision.action === "skip") return "skipped";
  return "created";
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
