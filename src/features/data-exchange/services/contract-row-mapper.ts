import {
  CONTRACT_SOURCE_FIELDS,
  CONTRACT_SOURCE_HEADERS,
  type ContractRowIssue,
  type ContractSourceField,
  type ContractSourceRow,
} from "../types/contract-source";
import type {
  ImportDuplicateKey,
  MappedContractPolicy,
} from "../types/import-preview";
import {
  canonicalPremium,
  isAsciiDigits,
  isBoundedUnicodeText,
  isCalendarDate,
  isYearMonth,
  MAX_DOMAIN_TEXT_CHARS,
  normalizedOptionalText,
} from "./contract-normalization";

interface Normalized<T> {
  readonly value: T;
  readonly valid: boolean;
}

export interface PreparedImportRow {
  readonly source: ContractSourceRow;
  readonly mapped: MappedContractPolicy | null;
  readonly issues: readonly ContractRowIssue[];
  readonly duplicateKey: ImportDuplicateKey | null;
}

export function mapContractSourceRow(
  source: ContractSourceRow,
  parserIssues: readonly ContractRowIssue[] = [],
): PreparedImportRow {
  const issues = [...parserIssues];
  const hasParserIssue = (field: ContractSourceField): boolean =>
    parserIssues.some((issue) => issue.field === field);
  const add = (field: ContractSourceField, code: string, message: string): void => {
    if (!hasParserIssue(field)) {
      issues.push({ sourceRow: source.sourceRow, field, code, message });
    }
  };

  const insurer = requiredText(source, "insurer", add, hasParserIssue);
  const productName = requiredText(source, "productName", add, hasParserIssue);
  const status = optionalText(source, "status", add, hasParserIssue);
  const paymentTerm = optionalText(source, "paymentTerm", add, hasParserIssue);
  const joinedOn = optionalDate(source, "contractedOn", add, hasParserIssue);
  const maturesOn = optionalDate(source, "coverageEndsOn", add, hasParserIssue);

  optionalDate(source, "collectionReflectedOn", add, hasParserIssue);
  optionalDate(source, "coverageStartsOn", add, hasParserIssue);
  validateYearMonth(source, add, hasParserIssue);
  validatePaymentSequence(source, add, hasParserIssue);
  const premium = requiredPremium(source, add, hasParserIssue);

  const mappingIsValid = [
    insurer,
    productName,
    status,
    paymentTerm,
    joinedOn,
    maturesOn,
    premium,
  ].every((value) => value.valid);

  const mapped = mappingIsValid
    ? {
        insurer: insurer.value as string,
        productName: productName.value as string,
        joinedOn: joinedOn.value,
        status: status.value,
        monthlyPremiumWon: premium.value as string,
        maturesOn: maturesOn.value,
        paymentTerm: paymentTerm.value,
        coverageTerm: null,
        disclosurePlan: null,
        renewable: false,
        isIncluded: true,
      } satisfies MappedContractPolicy
    : null;

  const policyNumber = normalizedOptionalText(source.cells.policyNumber);
  const duplicateKey = insurer.valid && policyNumber !== null
    ? { insurer: insurer.value as string, policyNumber }
    : null;

  return {
    source,
    mapped,
    issues: sortIssues(issues),
    duplicateKey,
  };
}

function requiredText(
  source: ContractSourceRow,
  field: "insurer" | "productName",
  add: IssueAdder,
  blocked: IssueBlocker,
): Normalized<string | null> {
  const normalized = normalizedOptionalText(source.cells[field]);
  if (blocked(field)) return { value: normalized, valid: false };
  if (normalized === null) {
    add(field, "REQUIRED", `${CONTRACT_SOURCE_HEADERS[field]} 값이 필요합니다.`);
    return { value: null, valid: false };
  }
  if (!isBoundedUnicodeText(normalized, MAX_DOMAIN_TEXT_CHARS)) {
    add(field, "TEXT_TOO_LONG", `${CONTRACT_SOURCE_HEADERS[field]}은(는) 200자 이하여야 합니다.`);
    return { value: normalized, valid: false };
  }
  return { value: normalized, valid: true };
}

function optionalText(
  source: ContractSourceRow,
  field: "status" | "paymentTerm",
  add: IssueAdder,
  blocked: IssueBlocker,
): Normalized<string | null> {
  const normalized = normalizedOptionalText(source.cells[field]);
  if (blocked(field)) return { value: normalized, valid: false };
  if (normalized !== null && !isBoundedUnicodeText(normalized, MAX_DOMAIN_TEXT_CHARS)) {
    add(field, "TEXT_TOO_LONG", `${CONTRACT_SOURCE_HEADERS[field]}은(는) 200자 이하여야 합니다.`);
    return { value: normalized, valid: false };
  }
  return { value: normalized, valid: true };
}

function optionalDate(
  source: ContractSourceRow,
  field: "collectionReflectedOn" | "contractedOn" | "coverageStartsOn" | "coverageEndsOn",
  add: IssueAdder,
  blocked: IssueBlocker,
): Normalized<string | null> {
  const normalized = normalizedOptionalText(source.cells[field]);
  if (blocked(field)) return { value: normalized, valid: false };
  if (normalized !== null && !isCalendarDate(normalized)) {
    add(field, "INVALID_DATE", `${CONTRACT_SOURCE_HEADERS[field]}은(는) 실제 YYYY-MM-DD 날짜여야 합니다.`);
    return { value: null, valid: false };
  }
  return { value: normalized, valid: true };
}

function validateYearMonth(source: ContractSourceRow, add: IssueAdder, blocked: IssueBlocker): void {
  const field = "finalPaymentMonth";
  const value = normalizedOptionalText(source.cells[field]);
  if (!blocked(field) && value !== null && !isYearMonth(value)) {
    add(field, "INVALID_YEAR_MONTH", "최종납월은 실제 YYYYMM이어야 합니다.");
  }
}

function validatePaymentSequence(
  source: ContractSourceRow,
  add: IssueAdder,
  blocked: IssueBlocker,
): void {
  const field = "paymentSequence";
  const value = normalizedOptionalText(source.cells[field]);
  if (!blocked(field) && value !== null && !isAsciiDigits(value)) {
    add(field, "INVALID_DIGITS", "납입회차는 ASCII 숫자여야 합니다.");
  }
}

function requiredPremium(
  source: ContractSourceRow,
  add: IssueAdder,
  blocked: IssueBlocker,
): Normalized<string | null> {
  const field = "paymentPremium";
  const value = normalizedOptionalText(source.cells[field]);
  if (blocked(field)) return { value, valid: false };
  if (value === null) {
    add(field, "REQUIRED", "납입보험료 값이 필요합니다.");
    return { value: null, valid: false };
  }
  const canonical = canonicalPremium(value);
  if (canonical === null) {
    add(field, "INVALID_PREMIUM", "납입보험료는 저장 범위 안의 0 이상 원 단위 정수여야 합니다.");
    return { value: null, valid: false };
  }
  return { value: canonical, valid: true };
}

type IssueAdder = (field: ContractSourceField, code: string, message: string) => void;
type IssueBlocker = (field: ContractSourceField) => boolean;

function sortIssues(issues: readonly ContractRowIssue[]): ContractRowIssue[] {
  const order = new Map(CONTRACT_SOURCE_FIELDS.map((field, index) => [field, index]));
  return [...issues].sort((left, right) =>
    (order.get(left.field as ContractSourceField) ?? 99) -
      (order.get(right.field as ContractSourceField) ?? 99) ||
    left.code.localeCompare(right.code, "en")
  );
}
