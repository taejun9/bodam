import { z } from "zod";

import {
  StoredCoverageCategorySchema,
  StoredCoverageWireSchema,
} from "../schemas/coverage-schema";
import { CoverageRepositoryError } from "../types/coverage-error";
import { INITIAL_COVERAGE_CATEGORY_SEEDS } from "./coverage-category-seed";

export interface CoverageStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoredCoverageCategory = z.infer<typeof StoredCoverageCategorySchema>;
export type StoredCoverageWire = z.infer<typeof StoredCoverageWireSchema>;

export const BROWSER_COVERAGE_CATEGORY_STORAGE_KEY =
  "bodam.preview.synthetic-coverage-categories.v1";
export const BROWSER_COVERAGE_STORAGE_KEY = "bodam.preview.synthetic-coverages.v1";

const categoryListSchema = z.array(StoredCoverageCategorySchema);
const coverageListSchema = z.array(StoredCoverageWireSchema);

export class BrowserCoverageStorage {
  constructor(
    private readonly storage: CoverageStoragePort,
    private readonly now: () => string,
  ) {}

  loadCategories(): StoredCoverageCategory[] {
    const serialized = this.read(BROWSER_COVERAGE_CATEGORY_STORAGE_KEY, "카테고리");
    if (serialized === null) {
      const timestamp = this.now();
      const seeds = INITIAL_COVERAGE_CATEGORY_SEEDS.map((seed) => ({
        ...seed,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      }));
      const parsed = categoryListSchema.safeParse(seeds);
      if (!parsed.success) {
        throw new CoverageRepositoryError("초기 보장 카테고리를 준비할 수 없습니다.");
      }
      this.saveCategories(parsed.data);
      return parsed.data;
    }
    return this.parse(serialized, categoryListSchema, "카테고리");
  }

  saveCategories(categories: readonly StoredCoverageCategory[]): void {
    this.write(BROWSER_COVERAGE_CATEGORY_STORAGE_KEY, categories, "카테고리");
  }

  loadCoverages(): StoredCoverageWire[] {
    const serialized = this.read(BROWSER_COVERAGE_STORAGE_KEY, "보장");
    if (serialized === null) return [];
    return this.parse(serialized, coverageListSchema, "보장");
  }

  saveCoverages(coverages: readonly StoredCoverageWire[]): void {
    this.write(BROWSER_COVERAGE_STORAGE_KEY, coverages, "보장");
  }

  private read(key: string, label: string): string | null {
    try {
      return this.storage.getItem(key);
    } catch {
      throw new CoverageRepositoryError(
        `미리보기 ${label} 저장소를 읽을 수 없습니다.`,
        "storage_unavailable",
      );
    }
  }

  private parse<T>(serialized: string, schema: z.ZodType<T>, label: string): T {
    try {
      const result = schema.safeParse(JSON.parse(serialized));
      if (result.success) return result.data;
    } catch {
      // Corrupt storage is reported without exposing its contents.
    }
    throw new CoverageRepositoryError(
      `저장된 미리보기 ${label} 데이터를 읽을 수 없습니다.`,
      "storage_corrupt",
    );
  }

  private write(key: string, value: unknown, label: string): void {
    try {
      this.storage.setItem(key, JSON.stringify(value));
    } catch {
      throw new CoverageRepositoryError(
        `미리보기 ${label} 저장소에 저장할 수 없습니다.`,
        "storage_unavailable",
      );
    }
  }
}
