import { InsuranceApplication } from "@/features/insurance/application/insurance-application";
import { createInsurancePolicyRepository } from "@/features/insurance/repositories/insurance-policy-repository-factory";

export const insuranceApplication = new InsuranceApplication(
  createInsurancePolicyRepository(),
);
