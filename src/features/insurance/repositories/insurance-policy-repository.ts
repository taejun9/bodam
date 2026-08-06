import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "../types/insurance-policy";

export interface InsurancePolicyRepository {
  list(customerId: string): Promise<InsurancePolicy[]>;
  create(customerId: string, input: InsurancePolicyInput): Promise<InsurancePolicy>;
  update(id: string, input: InsurancePolicyInput): Promise<InsurancePolicy>;
  remove(id: string): Promise<void>;
}
