import type { ContractFileFormat, ContractSourceRow } from "./contract-source";
import type { MappedContractPolicy } from "./import-preview";

export interface ExistingCustomerReference {
  readonly kind: "existing";
  readonly customerId: string;
}

export interface NewCustomerReference {
  readonly kind: "new";
  readonly clientKey: string;
}

export type ImportCustomerReference =
  | ExistingCustomerReference
  | NewCustomerReference;

export type ImportWriteAction = "create" | "separateCreate";

export type ImportRowDecision =
  | {
      readonly action: ImportWriteAction;
      readonly customer: ImportCustomerReference;
    }
  | {
      readonly action: "update";
      readonly targetPolicyId: string;
    }
  | {
      readonly action: "skip";
    };

export interface ImportCommitDraftRow {
  readonly sourceRow: number;
  readonly decision: ImportRowDecision;
}

export interface NewImportCustomer {
  readonly clientKey: string;
  readonly name: string;
}

export interface ImportCommitDraft {
  readonly previewId: string;
  readonly newCustomers: readonly NewImportCustomer[];
  readonly rows: readonly ImportCommitDraftRow[];
}

export interface ImportCommitRequestRow {
  readonly source: ContractSourceRow;
  readonly mapped: MappedContractPolicy;
  readonly decision: ImportRowDecision;
}

export interface ImportCommitSummary {
  readonly totalRows: number;
  readonly invalidRows: number;
  readonly unselectedRows: number;
}

export interface ImportCommitRequest {
  readonly previewId: string;
  readonly snapshotToken: string;
  readonly format: ContractFileFormat;
  readonly newCustomers: readonly NewImportCustomer[];
  readonly rows: readonly ImportCommitRequestRow[];
  readonly summary: ImportCommitSummary;
}

export type ImportCommitOutcomeKind = "created" | "updated" | "skipped";

export interface ImportCommitOutcome {
  readonly sourceRow: number;
  readonly outcome: ImportCommitOutcomeKind;
  readonly policyId: string | null;
}

export interface ImportCommitResult extends ImportCommitSummary {
  readonly created: number;
  readonly updated: number;
  readonly skipped: number;
  readonly outcomes: readonly ImportCommitOutcome[];
}
