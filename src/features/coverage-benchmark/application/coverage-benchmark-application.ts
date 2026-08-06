import {
  parseCoverageCategoryId,
  parseCoverageCategoryList,
  parseCoverageList,
} from "@/features/coverage/schemas/coverage-schema";
import type {
  Coverage,
  CoverageCategory,
} from "@/features/coverage/types/coverage";
import { parseCustomer } from "@/features/customer/schemas/customer-schema";
import type { Customer } from "@/features/customer/types/customer";
import { parseInsurancePolicyList } from "@/features/insurance/schemas/insurance-policy-schema";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type { CoverageBenchmarkRepository } from "../repositories/coverage-benchmark-repository";
import {
  parseCoverageBenchmark,
  parseCoverageBenchmarkId,
  parseCoverageBenchmarkInput,
  parseCoverageBenchmarkList,
} from "../schemas/coverage-benchmark-schema";
import { assessCustomerCoverage } from "../services/coverage-assessment";
import {
  categoryBenchmarkUsageCount,
  sortCoverageBenchmarks,
} from "../services/coverage-benchmark-rules";
import type {
  CoverageAssessment,
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";

export class CoverageBenchmarkApplication {
  constructor(private readonly repository: CoverageBenchmarkRepository) {}

  async list(): Promise<CoverageBenchmark[]> {
    return sortCoverageBenchmarks(
      parseCoverageBenchmarkList(await this.repository.list()),
    );
  }

  async create(input: CoverageBenchmarkInput): Promise<CoverageBenchmark> {
    const parsedInput = parseCoverageBenchmarkInput(input);
    return parseCoverageBenchmark(await this.repository.create(parsedInput));
  }

  async update(
    id: string,
    input: CoverageBenchmarkInput,
  ): Promise<CoverageBenchmark> {
    const parsedId = parseCoverageBenchmarkId(id);
    const parsedInput = parseCoverageBenchmarkInput(input);
    return parseCoverageBenchmark(
      await this.repository.update(parsedId, parsedInput),
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseCoverageBenchmarkId(id));
  }

  assessCustomer(
    customer: Customer,
    categories: readonly CoverageCategory[],
    policies: readonly InsurancePolicy[],
    coverages: readonly Coverage[],
    benchmarks: readonly CoverageBenchmark[],
    referenceDate: string,
  ): CoverageAssessment[] {
    return assessCustomerCoverage(
      parseCustomer(customer),
      parseCoverageCategoryList(categories),
      parseInsurancePolicyList(policies),
      parseCoverageList(coverages),
      parseCoverageBenchmarkList(benchmarks),
      referenceDate,
    );
  }

  categoryBenchmarkUsageCount(
    benchmarks: readonly CoverageBenchmark[],
    categoryId: string,
  ): number {
    return categoryBenchmarkUsageCount(
      parseCoverageBenchmarkList(benchmarks),
      parseCoverageCategoryId(categoryId),
    );
  }
}
