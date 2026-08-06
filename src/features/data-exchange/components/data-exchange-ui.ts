export const IMPORT_SOURCE_FIELDS = [
  ["no", "No"],
  ["collectionReflectedOn", "수금반영일"],
  ["affiliation", "소속"],
  ["manager", "담당자"],
  ["collectionCode", "수금인코드"],
  ["contract", "계약"],
  ["insurer", "보험사"],
  ["productName", "상품명"],
  ["policyNumber", "증권번호"],
  ["contractedOn", "계약일자"],
  ["status", "상태"],
  ["finalPaymentMonth", "최종납월"],
  ["paymentSequence", "납입회차"],
  ["paymentPremium", "납입보험료"],
  ["contractor", "계약자"],
  ["insured", "피보험자"],
  ["coverageStartsOn", "보험시기"],
  ["coverageEndsOn", "보험종기"],
  ["collectionMethod", "수금방법"],
  ["paymentTerm", "납기"],
  ["originalRecruiterName", "원모집자명"],
] as const;

export type ImportSourceKey = (typeof IMPORT_SOURCE_FIELDS)[number][0];
export type ImportFileFormat = "xlsx" | "csv";

export type ImportSourceValues = Readonly<
  Record<ImportSourceKey, string | null>
>;

export interface ImportUiIssue {
  readonly sourceRow: number | null;
  readonly field: ImportSourceKey | "row" | "file";
  readonly code: string;
  readonly message: string;
}

export interface ImportUiCustomer {
  readonly id: string;
  readonly name: string;
  readonly label?: string;
}

export interface ImportUiDuplicateCandidate {
  readonly policyId: string;
  readonly customerName: string;
  readonly insurer: string;
  readonly productName: string;
}

export interface ImportUiMappedPolicy {
  readonly insurer: string;
  readonly productName: string;
  readonly joinedOn: string | null;
  readonly status: string | null;
  readonly monthlyPremiumWon: string;
  readonly maturesOn: string | null;
  readonly paymentTerm: string | null;
}

export interface ImportUiRow {
  readonly sourceRow: number;
  readonly source: ImportSourceValues;
  readonly mapped: ImportUiMappedPolicy | null;
  readonly issues: readonly ImportUiIssue[];
  readonly duplicateCandidates: readonly ImportUiDuplicateCandidate[];
  readonly batchDuplicateOf: number | null;
  readonly defaultDecision: "invalid" | "create" | "skip";
}

export interface ImportUiPreview {
  readonly previewId: string;
  readonly fileName: string;
  readonly format: ImportFileFormat;
  readonly rows: readonly ImportUiRow[];
  readonly issues: readonly ImportUiIssue[];
  readonly customers: readonly ImportUiCustomer[];
}

export interface NewCustomerDefinition {
  readonly clientKey: string;
  readonly name: string;
}

export type CustomerResolution =
  | { readonly kind: "existing"; readonly customerId: string }
  | { readonly kind: "new"; readonly clientKey: string };

export type DuplicateAction = "create" | "skip" | "update" | "separate-create";

export interface ImportUiRowDecision {
  readonly sourceRow: number;
  readonly selected: boolean;
  readonly customer: CustomerResolution | null;
  readonly duplicateAction: DuplicateAction;
  readonly duplicateTargetPolicyId: string | null;
}

export interface ImportUiCommitRow extends ImportUiRowDecision {
  readonly source: ImportSourceValues;
  readonly mapped: ImportUiMappedPolicy;
  readonly duplicateSnapshotPolicyIds: readonly string[];
}

export interface ImportUiCommitRequest {
  readonly previewId: string;
  readonly fileName: string;
  readonly format: ImportFileFormat;
  readonly rows: readonly ImportUiCommitRow[];
  readonly newCustomers: readonly NewCustomerDefinition[];
}

export interface ImportUiOutcome {
  readonly sourceRow: number;
  readonly outcome: "created" | "updated" | "skipped" | "unselected" | "invalid";
}

export interface ImportUiResult {
  readonly createdCount: number;
  readonly updatedCount: number;
  readonly skippedCount: number;
  readonly unselectedCount: number;
  readonly invalidCount: number;
  readonly outcomes: readonly ImportUiOutcome[];
}

export interface ImportUiPort {
  readonly selectFile: () => Promise<ImportUiPreview | null>;
  readonly commitImport: (request: ImportUiCommitRequest) => Promise<ImportUiResult>;
  readonly clear?: () => void;
}

export function rowCanWrite(decision: ImportUiRowDecision): boolean {
  return decision.selected && decision.duplicateAction !== "skip";
}

export function rowNeedsCustomer(decision: ImportUiRowDecision): boolean {
  return decision.duplicateAction === "create" ||
    decision.duplicateAction === "separate-create";
}
