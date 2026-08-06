export interface CoverageCategoryInput {
  readonly name: string;
}

export interface CoverageCategory extends CoverageCategoryInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoverageInput {
  readonly categoryId: string;
  readonly amountWon: bigint;
}

export interface Coverage extends CoverageInput {
  readonly id: string;
  readonly policyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoverageWireInput {
  readonly categoryId: string;
  readonly amountWon: string;
}

export interface CoverageWire extends CoverageWireInput {
  readonly id: string;
  readonly policyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CoverageDeleteResult {
  readonly id: string;
}

export interface CoverageSummary {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountWon: bigint;
  readonly coverageCount: number;
}
