export const CONTRACT_FILE_FORMATS = ["xlsx", "csv"] as const;

export type ContractFileFormat = (typeof CONTRACT_FILE_FORMATS)[number];

export const CONTRACT_SOURCE_FIELDS = [
  "no",
  "collectionReflectedOn",
  "affiliation",
  "manager",
  "collectionCode",
  "contract",
  "insurer",
  "productName",
  "policyNumber",
  "contractedOn",
  "status",
  "finalPaymentMonth",
  "paymentSequence",
  "paymentPremium",
  "contractor",
  "insured",
  "coverageStartsOn",
  "coverageEndsOn",
  "collectionMethod",
  "paymentTerm",
  "originalRecruiterName",
] as const;

export type ContractSourceField = (typeof CONTRACT_SOURCE_FIELDS)[number];

export const CONTRACT_SOURCE_HEADERS: Readonly<Record<ContractSourceField, string>> = {
  no: "No",
  collectionReflectedOn: "수금반영일",
  affiliation: "소속",
  manager: "담당자",
  collectionCode: "수금인코드",
  contract: "계약",
  insurer: "보험사",
  productName: "상품명",
  policyNumber: "증권번호",
  contractedOn: "계약일자",
  status: "상태",
  finalPaymentMonth: "최종납월",
  paymentSequence: "납입회차",
  paymentPremium: "납입보험료",
  contractor: "계약자",
  insured: "피보험자",
  coverageStartsOn: "보험시기",
  coverageEndsOn: "보험종기",
  collectionMethod: "수금방법",
  paymentTerm: "납기",
  originalRecruiterName: "원모집자명",
};

export type ContractSourceCells = {
  readonly [Field in ContractSourceField]: string | null;
};

export interface ContractSourceRow {
  readonly sourceRow: number;
  readonly format: ContractFileFormat;
  readonly cells: ContractSourceCells;
}

export type ContractIssueField = ContractSourceField | "row";

export interface ContractRowIssue {
  readonly sourceRow: number;
  readonly field: ContractIssueField;
  readonly code: string;
  readonly message: string;
}

export interface ParsedImportFile {
  readonly basename: string;
  readonly format: ContractFileFormat;
  readonly rows: readonly ContractSourceRow[];
  readonly issues: readonly ContractRowIssue[];
}
