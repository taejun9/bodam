import type {
  DashboardCoverageAssessmentFact,
  DashboardSources,
} from "../types/dashboard";
import { parseCalendarDate, utcInstantToLocalDate } from "./dashboard-date";

const invalid = (field: string, message: string): TypeError =>
  new TypeError(`${field}: ${message}`);

const isArrayValue = (value: unknown): boolean => Array.isArray(value);

function assertText(value: string, field: string): void {
  if (typeof value !== "string" || value.length === 0) {
    throw invalid(field, "빈 문자열이 아닌 text여야 합니다.");
  }
}

function assertNonnegativeAmount(value: bigint, field: string): void {
  if (typeof value !== "bigint" || value < 0n) {
    throw invalid(field, "0 이상의 bigint여야 합니다.");
  }
}

function assertCoverage(
  assessment: DashboardCoverageAssessmentFact,
  field: string,
): void {
  assertText(assessment.categoryId, `${field}.categoryId`);
  assertText(assessment.categoryName, `${field}.categoryName`);
  assertNonnegativeAmount(assessment.amountWon, `${field}.amountWon`);
  const configured = assessment.status !== "unconfigured";
  if (
    !["insufficient", "adequate", "excessive", "unconfigured"]
      .includes(assessment.status)
  ) {
    throw invalid(`${field}.status`, "지원하는 보장 판정이어야 합니다.");
  }
  if (configured) {
    if (assessment.adequateMinWon === null) {
      throw invalid(`${field}.adequateMinWon`, "설정된 판정에는 기준값이 필요합니다.");
    }
    assertNonnegativeAmount(
      assessment.adequateMinWon,
      `${field}.adequateMinWon`,
    );
  } else if (assessment.adequateMinWon !== null) {
    throw invalid(`${field}.adequateMinWon`, "기준 미설정 판정에는 null이어야 합니다.");
  }
  if (
    assessment.status === "insufficient" &&
    assessment.adequateMinWon !== null &&
    assessment.amountWon >= assessment.adequateMinWon
  ) {
    throw invalid(field, "부족 판정의 금액은 적정하한보다 작아야 합니다.");
  }
}

function assertUnique(values: readonly string[], field: string): void {
  if (new Set(values).size !== values.length) {
    throw invalid(field, "식별자가 중복되었습니다.");
  }
}

export function validateDashboardSources(
  sources: DashboardSources,
  timeZone: string,
): void {
  if (!isArrayValue(sources.customers) || !isArrayValue(sources.families)) {
    throw invalid("sources", "customers와 families 배열이 필요합니다.");
  }
  assertUnique(sources.customers.map(({ customerId }) => customerId), "customers");
  assertUnique(sources.families.map(({ familyId }) => familyId), "families");

  sources.customers.forEach((customer, customerIndex) => {
    const field = `customers.${customerIndex}`;
    assertText(customer.customerId, `${field}.customerId`);
    assertText(customer.customerName, `${field}.customerName`);
    if (typeof customer.isManaged !== "boolean") {
      throw invalid(`${field}.isManaged`, "boolean이어야 합니다.");
    }
    if (customer.birthDate !== null) {
      parseCalendarDate(customer.birthDate, `${field}.birthDate`);
    }
    assertNonnegativeAmount(
      customer.totalMonthlyPremiumWon,
      `${field}.totalMonthlyPremiumWon`,
    );
    if (
      !isArrayValue(customer.policies) ||
      !isArrayValue(customer.consultations) ||
      !isArrayValue(customer.coverageAssessments)
    ) {
      throw invalid(field, "child fact는 배열이어야 합니다.");
    }
    assertUnique(customer.policies.map(({ policyId }) => policyId), `${field}.policies`);
    assertUnique(
      customer.consultations.map(({ consultationId }) => consultationId),
      `${field}.consultations`,
    );
    assertUnique(
      customer.coverageAssessments.map(({ categoryId }) => categoryId),
      `${field}.coverageAssessments`,
    );
    customer.policies.forEach((policy, index) => {
      const policyField = `${field}.policies.${index}`;
      assertText(policy.policyId, `${policyField}.policyId`);
      assertText(policy.insurer, `${policyField}.insurer`);
      assertText(policy.productName, `${policyField}.productName`);
      if (policy.maturesOn !== null) {
        parseCalendarDate(policy.maturesOn, `${policyField}.maturesOn`);
      }
      if (typeof policy.isIncluded !== "boolean") {
        throw invalid(`${policyField}.isIncluded`, "boolean이어야 합니다.");
      }
    });
    customer.consultations.forEach((consultation, index) => {
      const consultationField = `${field}.consultations.${index}`;
      assertText(consultation.consultationId, `${consultationField}.consultationId`);
      utcInstantToLocalDate(consultation.consultedAt, timeZone);
      if (consultation.nextContactOn !== null) {
        parseCalendarDate(
          consultation.nextContactOn,
          `${consultationField}.nextContactOn`,
        );
      }
    });
    customer.coverageAssessments.forEach((assessment, index) =>
      assertCoverage(assessment, `${field}.coverageAssessments.${index}`)
    );
  });

  sources.families.forEach((family, index) => {
    const field = `families.${index}`;
    assertText(family.familyId, `${field}.familyId`);
    assertText(family.familyName, `${field}.familyName`);
    if (!Number.isSafeInteger(family.memberCount) || family.memberCount < 0) {
      throw invalid(`${field}.memberCount`, "0 이상의 정수여야 합니다.");
    }
    assertNonnegativeAmount(
      family.totalMonthlyPremiumWon,
      `${field}.totalMonthlyPremiumWon`,
    );
  });
}
