import type {
  ContractRowIssue,
  ContractSourceRow,
  ParsedImportFile,
} from "./contract-source";

export interface MappedContractPolicy {
  readonly insurer: string;
  readonly productName: string;
  readonly joinedOn: string | null;
  readonly status: string | null;
  readonly monthlyPremiumWon: string;
  readonly maturesOn: string | null;
  readonly paymentTerm: string | null;
  readonly coverageTerm: null;
  readonly disclosurePlan: null;
  readonly renewable: false;
  readonly isIncluded: true;
}

export interface ImportDuplicateKey {
  readonly insurer: string;
  readonly policyNumber: string;
}

export interface ImportCustomerOption {
  readonly id: string;
  readonly name: string;
}

export interface ImportDuplicateCandidate extends ImportDuplicateKey {
  readonly policyId: string;
  readonly customerId: string;
  readonly productName: string;
}

export interface ImportContextQuery {
  readonly keys: readonly ImportDuplicateKey[];
}

export interface ImportContextSnapshot {
  readonly snapshotToken: string;
  readonly customers: readonly ImportCustomerOption[];
  readonly duplicateCandidates: readonly ImportDuplicateCandidate[];
}

export type ImportDefaultDecision = "invalid" | "create" | "skip";

export interface ImportPreviewRow {
  readonly source: ContractSourceRow;
  readonly mapped: MappedContractPolicy | null;
  readonly issues: readonly ContractRowIssue[];
  readonly duplicateKey: ImportDuplicateKey | null;
  readonly duplicateCandidates: readonly ImportDuplicateCandidate[];
  readonly batchDuplicateOf: number | null;
  readonly defaultDecision: ImportDefaultDecision;
}

export interface ContractImportPreview extends Omit<ParsedImportFile, "rows" | "issues"> {
  readonly previewId: string;
  readonly snapshotToken: string;
  readonly customers: readonly ImportCustomerOption[];
  readonly rows: readonly ImportPreviewRow[];
}
