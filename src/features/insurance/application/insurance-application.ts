import type { InsurancePolicyRepository } from "../repositories/insurance-policy-repository";
import {
  parseInsuranceCustomerId,
  parseInsurancePolicy,
  parseInsurancePolicyId,
  parseInsurancePolicyInput,
  parseInsurancePolicyList,
} from "../schemas/insurance-policy-schema";
import { calculateIncludedMonthlyPremiumTotal } from "../services/monthly-premium-total";
import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "../types/insurance-policy";

export class InsuranceApplication {
  constructor(private readonly repository: InsurancePolicyRepository) {}

  async list(customerId: string): Promise<InsurancePolicy[]> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    return parseInsurancePolicyList(await this.repository.list(parsedCustomerId));
  }

  async create(
    customerId: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    const parsedInput = parseInsurancePolicyInput(input);
    return parseInsurancePolicy(
      await this.repository.create(parsedCustomerId, parsedInput),
    );
  }

  async update(
    id: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedId = parseInsurancePolicyId(id);
    const parsedInput = parseInsurancePolicyInput(input);
    return parseInsurancePolicy(await this.repository.update(parsedId, parsedInput));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseInsurancePolicyId(id));
  }

  total(policies: readonly InsurancePolicy[]): bigint {
    const activePolicies = parseInsurancePolicyList(policies);
    return calculateIncludedMonthlyPremiumTotal(activePolicies);
  }
}
