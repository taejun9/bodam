import { CoverageApplication } from "@/features/coverage/application/coverage-application";
import { createCoverageRepository } from "@/features/coverage/repositories/coverage-repository-factory";

export const coverageApplication = new CoverageApplication(
  createCoverageRepository(),
);
