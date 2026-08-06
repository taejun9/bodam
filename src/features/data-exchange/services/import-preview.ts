import { parseImportContextQuery } from "../schemas/import-context-schema";
import type { ParsedImportFile } from "../types/contract-source";
import { DataExchangeRepositoryError } from "../types/data-exchange-error";
import type {
  ContractImportPreview,
  ImportContextQuery,
  ImportContextSnapshot,
  ImportDuplicateCandidate,
  ImportDuplicateKey,
  ImportPreviewRow,
} from "../types/import-preview";
import {
  mapContractSourceRow,
  type PreparedImportRow,
} from "./contract-row-mapper";

export interface PreparedImportFile {
  readonly file: ParsedImportFile;
  readonly rows: readonly PreparedImportRow[];
  readonly contextQuery: ImportContextQuery;
}

export function prepareImportFile(file: ParsedImportFile): PreparedImportFile {
  const issuesByRow = new Map<number, typeof file.issues>();
  file.issues.forEach((issue) => {
    const current = issuesByRow.get(issue.sourceRow) ?? [];
    issuesByRow.set(issue.sourceRow, [...current, issue]);
  });
  const rows = file.rows.map((source) =>
    mapContractSourceRow(source, issuesByRow.get(source.sourceRow) ?? [])
  );

  const keys: ImportDuplicateKey[] = [];
  const seen = new Set<string>();
  rows.forEach((row) => {
    if (row.issues.length > 0 || row.mapped === null || row.duplicateKey === null) return;
    const encoded = encodeKey(row.duplicateKey);
    if (!seen.has(encoded)) {
      seen.add(encoded);
      keys.push(row.duplicateKey);
    }
  });

  return {
    file,
    rows,
    contextQuery: parseImportContextQuery({ keys }),
  };
}

export function buildImportPreview(
  prepared: PreparedImportFile,
  context: ImportContextSnapshot,
  previewId: string,
): ContractImportPreview {
  const requested = new Set(prepared.contextQuery.keys.map(encodeKey));
  const candidatesByKey = new Map<string, ImportDuplicateCandidate[]>();
  context.duplicateCandidates.forEach((candidate) => {
    const encoded = encodeKey(candidate);
    if (!requested.has(encoded)) throw invalidContext();
    const candidates = candidatesByKey.get(encoded) ?? [];
    candidatesByKey.set(encoded, [...candidates, candidate]);
  });
  candidatesByKey.forEach((candidates) =>
    candidates.sort((left, right) => compareText(left.policyId, right.policyId))
  );

  const firstBatchRow = new Map<string, number>();
  const rows: ImportPreviewRow[] = prepared.rows.map((row) => {
    const isValid = row.issues.length === 0 && row.mapped !== null;
    const encoded = row.duplicateKey === null ? null : encodeKey(row.duplicateKey);
    const candidates = encoded === null ? [] : candidatesByKey.get(encoded) ?? [];
    const earlier = isValid && encoded !== null ? firstBatchRow.get(encoded) ?? null : null;
    if (isValid && encoded !== null && earlier === null) {
      firstBatchRow.set(encoded, row.source.sourceRow);
    }
    const hasDuplicate = candidates.length > 0 || earlier !== null;
    return {
      ...row,
      duplicateCandidates: candidates,
      batchDuplicateOf: earlier,
      defaultDecision: !isValid ? "invalid" : hasDuplicate ? "skip" : "create",
    };
  });

  return {
    previewId,
    basename: prepared.file.basename,
    format: prepared.file.format,
    snapshotToken: context.snapshotToken,
    customers: [...context.customers].sort((left, right) =>
      compareText(left.name, right.name) || compareText(left.id, right.id)
    ),
    rows,
  };
}

export function encodeKey(key: ImportDuplicateKey): string {
  return JSON.stringify([key.insurer, key.policyNumber]);
}

function compareText(left: string, right: string): number {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function invalidContext(): DataExchangeRepositoryError {
  return new DataExchangeRepositoryError(
    "가져오기 중복 기준을 확인할 수 없습니다.",
    "invalid_response",
  );
}
