import type { Consultation } from "@/features/consultation/types/consultation";
import type {
  CoverageAssessment,
  CoverageBenchmark,
} from "@/features/coverage-benchmark/types/coverage-benchmark";
import type { Coverage, CoverageCategory } from "@/features/coverage/types/coverage";
import type { Customer } from "@/features/customer/types/customer";
import type { FamilySummary } from "@/features/family/types/family";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import {
  buildDashboardReadModel,
  validateDashboardQuery,
} from "../services/dashboard-read-model";
import type {
  DashboardCoverageAssessmentFact,
  DashboardCustomerFacts,
  DashboardQuery,
  DashboardReadModel,
} from "../types/dashboard";
import { DashboardApplicationError } from "../types/dashboard-error";

export interface DashboardCustomerReader {
  list(search?: string): Promise<readonly Customer[]>;
}

export interface DashboardInsuranceReader {
  list(customerId: string): Promise<readonly InsurancePolicy[]>;
  total(policies: readonly InsurancePolicy[]): bigint;
}

export interface DashboardFamilyReader {
  list(search?: string): Promise<readonly FamilySummary[]>;
}

export interface DashboardCoverageReader {
  listCategories(): Promise<readonly CoverageCategory[]>;
  list(customerId: string): Promise<readonly Coverage[]>;
}

export interface DashboardBenchmarkReader {
  list(): Promise<readonly CoverageBenchmark[]>;
  assessCustomer(
    customer: Customer,
    categories: readonly CoverageCategory[],
    policies: readonly InsurancePolicy[],
    coverages: readonly Coverage[],
    benchmarks: readonly CoverageBenchmark[],
    referenceDate: string,
  ): readonly CoverageAssessment[];
}

export interface DashboardConsultationReader {
  list(customerId: string): Promise<readonly Consultation[]>;
}

export type DashboardLoadQuery = Omit<DashboardQuery, "limit"> & {
  readonly limit?: number;
};

export class DashboardApplication {
  constructor(
    private readonly customers: DashboardCustomerReader,
    private readonly insurance: DashboardInsuranceReader,
    private readonly families: DashboardFamilyReader,
    private readonly coverage: DashboardCoverageReader,
    private readonly benchmarks: DashboardBenchmarkReader,
    private readonly consultations: DashboardConsultationReader,
  ) {}

  async load(query: DashboardLoadQuery): Promise<DashboardReadModel> {
    try {
      const parsedQuery = validateDashboardQuery({
        ...query,
        limit: query.limit ?? 10,
      });
      const [customers, families, categories, benchmarks] = await Promise.all([
        this.customers.list(),
        this.families.list(""),
        this.coverage.listCategories(),
        this.benchmarks.list(),
      ]);
      const customerFacts = await Promise.all(
        customers
          .filter((customer) => customer.isManaged)
          .map((customer) => this.customerFacts(
            customer,
            categories,
            benchmarks,
            parsedQuery.referenceDate,
          )),
      );
      return buildDashboardReadModel({
        customers: customerFacts,
        families: families.map((summary) => ({
          familyId: summary.family.id,
          familyName: summary.family.name,
          memberCount: summary.memberCount,
          totalMonthlyPremiumWon: summary.totalMonthlyPremiumWon,
        })),
      }, parsedQuery);
    } catch {
      throw new DashboardApplicationError();
    }
  }

  private async customerFacts(
    customer: Customer,
    categories: readonly CoverageCategory[],
    benchmarks: readonly CoverageBenchmark[],
    referenceDate: string,
  ): Promise<DashboardCustomerFacts> {
    const [policies, coverages, consultations] = await Promise.all([
      this.insurance.list(customer.id),
      this.coverage.list(customer.id),
      this.consultations.list(customer.id),
    ]);
    const assessments = this.benchmarks.assessCustomer(
      customer,
      categories,
      policies,
      coverages,
      benchmarks,
      referenceDate,
    );
    return {
      customerId: customer.id,
      customerName: customer.name,
      isManaged: customer.isManaged,
      birthDate: customer.birthDate,
      totalMonthlyPremiumWon: this.insurance.total(policies),
      policies: policies.map((policy) => ({
        policyId: policy.id,
        insurer: policy.insurer,
        productName: policy.productName,
        maturesOn: policy.maturesOn,
        isIncluded: policy.isIncluded,
      })),
      consultations: consultations.map((consultation) => ({
        consultationId: consultation.id,
        consultedAt: consultation.consultedAt,
        nextContactOn: consultation.nextContactOn,
      })),
      coverageAssessments: assessments.map(toCoverageAssessmentFact),
    };
  }
}

function toCoverageAssessmentFact(
  assessment: CoverageAssessment,
): DashboardCoverageAssessmentFact {
  return {
    categoryId: assessment.categoryId,
    categoryName: assessment.categoryName,
    amountWon: assessment.amountWon,
    status: assessment.status,
    adequateMinWon: assessment.benchmark?.adequateMinWon ?? null,
  };
}
