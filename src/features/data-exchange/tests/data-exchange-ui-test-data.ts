import type {
  ImportSourceValues,
  ImportUiMappedPolicy,
  ImportUiPreview,
  ImportUiResult,
} from "../components/data-exchange-ui";
import { IMPORT_SOURCE_FIELDS } from "../components/data-exchange-ui";

export const dataExchangeUiIds = {
  preview: "10000000-0000-4000-8000-000000000001",
  customerA: "20000000-0000-4000-8000-000000000001",
  customerB: "20000000-0000-4000-8000-000000000002",
  policy: "30000000-0000-4000-8000-000000000001",
  newCustomer: "40000000-0000-4000-8000-000000000001",
} as const;

function source(
  overrides: Partial<ImportSourceValues> = {},
): ImportSourceValues {
  return {
    ...Object.fromEntries(IMPORT_SOURCE_FIELDS.map(([key]) => [key, null])),
    no: "0001",
    insurer: "합성손해보험",
    productName: "합성 안심계약",
    policyNumber: "00000000000000001-A",
    contractedOn: "2024-02-29",
    status: "합성 유지",
    paymentPremium: "00120000",
    contractor: "합성 계약자",
    insured: "합성 피보험자",
    coverageEndsOn: "2044-02-29",
    paymentTerm: "20년납",
    ...overrides,
  } as ImportSourceValues;
}

function mapped(
  overrides: Partial<ImportUiMappedPolicy> = {},
): ImportUiMappedPolicy {
  return {
    insurer: "합성손해보험",
    productName: "합성 안심계약",
    joinedOn: "2024-02-29",
    status: "합성 유지",
    monthlyPremiumWon: "120000",
    maturesOn: "2044-02-29",
    paymentTerm: "20년납",
    ...overrides,
  };
}

export function dataExchangeUiPreview(): ImportUiPreview {
  return {
    previewId: dataExchangeUiIds.preview,
    fileName: "synthetic-contracts-valid.xlsx",
    format: "xlsx",
    issues: [],
    customers: [
      { id: dataExchangeUiIds.customerA, name: "합성 동명이인" },
      { id: dataExchangeUiIds.customerB, name: "합성 동명이인" },
    ],
    rows: [
      {
        sourceRow: 2,
        source: source(),
        mapped: mapped(),
        issues: [],
        duplicateCandidates: [],
        batchDuplicateOf: null,
        defaultDecision: "create",
      },
      {
        sourceRow: 3,
        source: source({
          no: "0002",
          productName: "합성 중복 변경계약",
        }),
        mapped: mapped({ productName: "합성 중복 변경계약" }),
        issues: [],
        duplicateCandidates: [
          {
            policyId: dataExchangeUiIds.policy,
            customerName: "합성 동명이인",
            insurer: "합성손해보험",
            productName: "합성 기존계약",
          },
        ],
        batchDuplicateOf: null,
        defaultDecision: "skip",
      },
      {
        sourceRow: 4,
        source: source({ contractedOn: "2026-02-30" }),
        mapped: null,
        issues: [
          {
            sourceRow: 4,
            field: "contractedOn",
            code: "invalid_date",
            message: "계약일자는 실제 YYYY-MM-DD 날짜여야 합니다.",
          },
        ],
        duplicateCandidates: [],
        batchDuplicateOf: null,
        defaultDecision: "invalid",
      },
    ],
  };
}

export const dataExchangeUiResult: ImportUiResult = {
  createdCount: 1,
  updatedCount: 1,
  skippedCount: 0,
  unselectedCount: 0,
  invalidCount: 1,
  outcomes: [
    { sourceRow: 2, outcome: "created" },
    { sourceRow: 3, outcome: "updated" },
  ],
};
