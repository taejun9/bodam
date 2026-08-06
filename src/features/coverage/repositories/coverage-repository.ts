import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
  CoverageInput,
} from "../types/coverage";

export interface CoverageRepository {
  listCategories(): Promise<CoverageCategory[]>;
  updateCategory(id: string, input: CoverageCategoryInput): Promise<CoverageCategory>;
  removeCategory(id: string): Promise<void>;
  list(customerId: string): Promise<Coverage[]>;
  create(customerId: string, policyId: string, input: CoverageInput): Promise<Coverage>;
  update(customerId: string, id: string, input: CoverageInput): Promise<Coverage>;
  remove(customerId: string, id: string): Promise<void>;
}
