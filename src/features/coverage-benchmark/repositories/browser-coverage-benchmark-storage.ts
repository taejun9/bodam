import { z } from "zod";

import { StoredCoverageBenchmarkWireSchema } from "../schemas/coverage-benchmark-schema";
import { CoverageBenchmarkRepositoryError } from "../types/coverage-benchmark-error";

export interface CoverageBenchmarkStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoredCoverageBenchmarkWire = z.infer<
  typeof StoredCoverageBenchmarkWireSchema
>;

export const BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY =
  "bodam.preview.synthetic-coverage-benchmarks.v1";

const storedListSchema = z
  .array(StoredCoverageBenchmarkWireSchema)
  .refine((benchmarks) => {
    const ids = new Set(benchmarks.map((benchmark) => benchmark.id));
    return ids.size === benchmarks.length;
  });

export class BrowserCoverageBenchmarkStorage {
  constructor(private readonly storage: CoverageBenchmarkStoragePort) {}

  load(): StoredCoverageBenchmarkWire[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY);
    } catch {
      throw new CoverageBenchmarkRepositoryError(
        "미리보기 보장 비교 기준 저장소를 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }
    if (serialized === null) return [];

    try {
      const parsed = storedListSchema.safeParse(JSON.parse(serialized));
      if (parsed.success) return parsed.data;
    } catch {
      // Corrupt data is reported without echoing its contents.
    }
    throw new CoverageBenchmarkRepositoryError(
      "저장된 미리보기 보장 비교 기준 데이터를 읽을 수 없습니다.",
      "storage_corrupt",
    );
  }

  save(benchmarks: readonly StoredCoverageBenchmarkWire[]): void {
    try {
      this.storage.setItem(
        BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY,
        JSON.stringify(benchmarks),
      );
    } catch {
      throw new CoverageBenchmarkRepositoryError(
        "미리보기 보장 비교 기준 저장소에 저장할 수 없습니다.",
        "storage_unavailable",
      );
    }
  }
}
