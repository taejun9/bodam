import { CoverageBenchmarkApplication } from "@/features/coverage-benchmark/application/coverage-benchmark-application";
import { createCoverageBenchmarkRepository } from "@/features/coverage-benchmark/repositories/coverage-benchmark-repository-factory";

export const coverageBenchmarkApplication = new CoverageBenchmarkApplication(
  createCoverageBenchmarkRepository(),
);
