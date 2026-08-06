import type {
  ContractSourceCells,
  ContractSourceRow,
  ParsedImportFile,
} from "../types/contract-source";
import type {
  ImportContextSnapshot,
  ImportDuplicateCandidate,
} from "../types/import-preview";

export const ids = {
  preview: "00000000-0000-4000-8000-000000000001",
  customerOne: "00000000-0000-4000-8000-000000000002",
  customerTwo: "00000000-0000-4000-8000-000000000003",
  policyOne: "00000000-0000-4000-8000-000000000004",
  policyTwo: "00000000-0000-4000-8000-000000000005",
  clientOne: "00000000-0000-4000-8000-000000000006",
  clientUnused: "00000000-0000-4000-8000-000000000007",
} as const;

export function sourceCells(
  overrides: Partial<Record<keyof ContractSourceCells, string | null>> = {},
): ContractSourceCells {
  return {
    no: "1",
    collectionReflectedOn: "2026-08-01",
    affiliation: "합성 지점",
    manager: "합성 담당",
    collectionCode: "000-CODE",
    contract: "합성 계약",
    insurer: "합성보험",
    productName: "합성상품",
    policyNumber: "000-POLICY",
    contractedOn: "2026-01-31",
    status: "유지",
    finalPaymentMonth: "202608",
    paymentSequence: "0007",
    paymentPremium: "001200",
    contractor: "합성 계약자",
    insured: "합성 피보험자",
    coverageStartsOn: "2026-02-01",
    coverageEndsOn: "2036-01-31",
    collectionMethod: null,
    paymentTerm: "10년",
    originalRecruiterName: "합성 모집자",
    ...overrides,
  };
}

export function sourceRow(
  sourceRowNumber = 2,
  overrides: Partial<Record<keyof ContractSourceCells, string | null>> = {},
): ContractSourceRow {
  return {
    sourceRow: sourceRowNumber,
    format: "xlsx",
    cells: sourceCells(overrides),
  };
}

export function parsedFile(rows: readonly ContractSourceRow[] = [sourceRow()]): ParsedImportFile {
  return {
    basename: "synthetic-contracts.xlsx",
    format: "xlsx",
    rows,
    issues: [],
  };
}

export function duplicateCandidate(
  overrides: Partial<ImportDuplicateCandidate> = {},
): ImportDuplicateCandidate {
  return {
    policyId: ids.policyOne,
    customerId: ids.customerOne,
    insurer: "합성보험",
    productName: "기존 합성상품",
    policyNumber: "000-POLICY",
    ...overrides,
  };
}

export function contextSnapshot(
  duplicateCandidates: readonly ImportDuplicateCandidate[] = [],
): ImportContextSnapshot {
  return {
    snapshotToken: "a".repeat(64),
    customers: [
      { id: ids.customerTwo, name: "하 합성" },
      { id: ids.customerOne, name: "가 합성" },
    ],
    duplicateCandidates,
  };
}
