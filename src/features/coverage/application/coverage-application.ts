import { parseInsurancePolicyList } from "@/features/insurance/schemas/insurance-policy-schema";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type { CoverageRepository } from "../repositories/coverage-repository";
import {
  parseCoverage,
  parseCoverageCategory,
  parseCoverageCategoryId,
  parseCoverageCategoryInput,
  parseCoverageCategoryList,
  parseCoverageCustomerId,
  parseCoverageId,
  parseCoverageInput,
  parseCoverageList,
  parseCoveragePolicyId,
} from "../schemas/coverage-schema";
import {
  calculateCoverageSummary,
  countCategoryUsage,
  coveragesForPolicy,
} from "../services/coverage-summary";
import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
  CoverageInput,
  CoverageSummary,
} from "../types/coverage";

export class CoverageApplication {
  constructor(private readonly repository: CoverageRepository) {}

  async listCategories(): Promise<CoverageCategory[]> {
    return parseCoverageCategoryList(await this.repository.listCategories());
  }

  async updateCategory(
    id: string,
    input: CoverageCategoryInput,
  ): Promise<CoverageCategory> {
    const parsedId = parseCoverageCategoryId(id);
    const parsedInput = parseCoverageCategoryInput(input);
    return parseCoverageCategory(
      await this.repository.updateCategory(parsedId, parsedInput),
    );
  }

  async removeCategory(id: string): Promise<void> {
    await this.repository.removeCategory(parseCoverageCategoryId(id));
  }

  async list(customerId: string): Promise<Coverage[]> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    return parseCoverageList(await this.repository.list(parsedCustomerId));
  }

  async create(
    customerId: string,
    policyId: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    const parsedPolicyId = parseCoveragePolicyId(policyId);
    const parsedInput = parseCoverageInput(input);
    return parseCoverage(
      await this.repository.create(parsedCustomerId, parsedPolicyId, parsedInput),
    );
  }

  async update(
    customerId: string,
    id: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    const parsedId = parseCoverageId(id);
    const parsedInput = parseCoverageInput(input);
    return parseCoverage(
      await this.repository.update(parsedCustomerId, parsedId, parsedInput),
    );
  }

  async remove(customerId: string, id: string): Promise<void> {
    await this.repository.remove(
      parseCoverageCustomerId(customerId),
      parseCoverageId(id),
    );
  }

  summary(
    categories: readonly CoverageCategory[],
    policies: readonly InsurancePolicy[],
    coverages: readonly Coverage[],
  ): CoverageSummary[] {
    return calculateCoverageSummary(
      parseCoverageCategoryList(categories),
      parseInsurancePolicyList(policies),
      parseCoverageList(coverages),
    );
  }

  forPolicy(coverages: readonly Coverage[], policyId: string): Coverage[] {
    return coveragesForPolicy(
      parseCoverageList(coverages),
      parseCoveragePolicyId(policyId),
    );
  }

  categoryUsageCount(coverages: readonly Coverage[], categoryId: string): number {
    return countCategoryUsage(
      parseCoverageList(coverages),
      parseCoverageCategoryId(categoryId),
    );
  }
}
