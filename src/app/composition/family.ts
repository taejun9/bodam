import { customerApplication } from "@/app/composition/customer";
import { insuranceApplication } from "@/app/composition/insurance";
import { FamilyApplication } from "@/features/family/application/family-application";
import { createFamilyRepository } from "@/features/family/repositories/family-repository-factory";

export const familyApplication = new FamilyApplication(
  createFamilyRepository(),
  customerApplication,
  insuranceApplication,
);
