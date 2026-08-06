import {
  StoredCoverageCategorySchema,
  StoredCoverageWireSchema,
  parseCoverageCategory,
  parseCoverageWire,
} from "../schemas/coverage-schema";
import type {
  Coverage,
  CoverageCategory,
  CoverageWire,
} from "../types/coverage";
import { CoverageRepositoryError } from "../types/coverage-error";
import type {
  StoredCoverageCategory,
  StoredCoverageWire,
} from "./browser-coverage-storage";

export function parseStoredCategory(value: unknown): StoredCoverageCategory {
  const result = StoredCoverageCategorySchema.safeParse(value);
  if (!result.success) {
    throw new CoverageRepositoryError("보장 카테고리 데이터를 저장할 수 없습니다.");
  }
  return result.data;
}

export function parseStoredCoverage(value: unknown): StoredCoverageWire {
  const result = StoredCoverageWireSchema.safeParse(value);
  if (!result.success) {
    throw new CoverageRepositoryError("보장 데이터를 저장할 수 없습니다.");
  }
  return result.data;
}

export function categoryFromStored(
  category: StoredCoverageCategory,
): CoverageCategory {
  return parseCoverageCategory({
    id: category.id,
    name: category.name,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  });
}

export function coverageFromStored(coverage: StoredCoverageWire): Coverage {
  const wire: CoverageWire = {
    id: coverage.id,
    policyId: coverage.policyId,
    categoryId: coverage.categoryId,
    amountWon: coverage.amountWon,
    createdAt: coverage.createdAt,
    updatedAt: coverage.updatedAt,
  };
  return parseCoverageWire(wire);
}
