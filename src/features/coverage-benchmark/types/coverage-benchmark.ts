export interface CoverageBenchmarkInput {
  readonly categoryId: string;
  readonly gender: string;
  readonly minAgeYears: number;
  readonly maxAgeYears: number;
  readonly adequateMinWon: bigint;
  readonly excessiveMinWon: bigint;
}

export interface CoverageBenchmark extends CoverageBenchmarkInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoverageBenchmarkWireInput {
  readonly categoryId: string;
  readonly gender: string;
  readonly minAgeYears: number;
  readonly maxAgeYears: number;
  readonly adequateMinWon: string;
  readonly excessiveMinWon: string;
}

export interface CoverageBenchmarkWire extends CoverageBenchmarkWireInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoverageBenchmarkDeleteResult {
  readonly id: string;
}

export type CoverageAssessmentStatus =
  | "insufficient"
  | "adequate"
  | "excessive"
  | "unconfigured";

export interface CoverageAssessment {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountWon: bigint;
  readonly coverageCount: number;
  readonly status: CoverageAssessmentStatus;
  readonly ageYears: number | null;
  readonly benchmark: CoverageBenchmark | null;
}
