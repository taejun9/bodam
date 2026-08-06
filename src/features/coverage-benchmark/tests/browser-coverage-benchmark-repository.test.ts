import { describe, expect, it } from "vitest";

import type { CoverageRepository } from "@/features/coverage/repositories/coverage-repository";
import type { CoverageCategory } from "@/features/coverage/types/coverage";

import { CoverageBenchmarkApplication } from "../application/coverage-benchmark-application";
import { BrowserCoverageBenchmarkRepository } from "../repositories/browser-coverage-benchmark-repository";
import {
  BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY,
  type CoverageBenchmarkStoragePort,
} from "../repositories/browser-coverage-benchmark-storage";
import {
  benchmarkIds,
  benchmarkInput,
  categories,
  categoryIds,
  timestamp,
} from "./coverage-benchmark-test-data";

class MemoryStorage implements CoverageBenchmarkStoragePort {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function categoryRepository(
  readCategories: () => readonly CoverageCategory[],
): Pick<CoverageRepository, "listCategories"> {
  return { listCategories: () => Promise.resolve([...readCategories()]) };
}

function createApplication(
  storage: MemoryStorage,
  readCategories: () => readonly CoverageCategory[],
): CoverageBenchmarkApplication {
  let idIndex = 0;
  return new CoverageBenchmarkApplication(
    new BrowserCoverageBenchmarkRepository({
      storage,
      coverageRepository: categoryRepository(readCategories),
      now: () => timestamp,
      createId: () => benchmarkIds[idIndex++] ?? benchmarkIds[4],
    }),
  );
}

describe("BrowserCoverageBenchmarkRepository", () => {
  it("starts seedless and stores canonical decimal strings under a separate key", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage, () => categories);

    await expect(application.list()).resolves.toEqual([]);
    expect(storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY)).toBeNull();
    const created = await application.create(benchmarkInput({
      gender: "  합성 성별  ",
      adequateMinWon: 0n,
      excessiveMinWon: 9_223_372_036_854_775_807n,
    }));
    expect(created).toMatchObject({
      id: benchmarkIds[0],
      gender: "합성 성별",
      adequateMinWon: 0n,
      excessiveMinWon: 9_223_372_036_854_775_807n,
    });

    expect(JSON.parse(
      storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY) ?? "[]",
    )).toMatchObject([{
      id: benchmarkIds[0],
      adequateMinWon: "0",
      excessiveMinWon: "9223372036854775807",
      deletedAt: null,
    }]);
  });

  it("sorts by category, min age, max age, then stable ID", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage, () => categories);
    const first = await application.create(benchmarkInput({
      minAgeYears: 30,
      maxAgeYears: 39,
    }));
    const second = await application.create(benchmarkInput({
      minAgeYears: 20,
      maxAgeYears: 29,
    }));
    const third = await application.create(benchmarkInput({
      categoryId: categoryIds[1],
    }));

    await expect(application.list()).resolves.toMatchObject([
      { id: second.id },
      { id: first.id },
      { id: third.id },
    ]);
  });

  it("serializes concurrent writes and rejects inclusive overlap atomically", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage, () => categories);
    const [first, second] = await Promise.allSettled([
      application.create(benchmarkInput({ minAgeYears: 0, maxAgeYears: 19 })),
      application.create(benchmarkInput({ minAgeYears: 19, maxAgeYears: 29 })),
    ]);
    expect(first.status).toBe("fulfilled");
    expect(second).toMatchObject({
      status: "rejected",
      reason: { code: "conflict" },
    });
    await expect(application.list()).resolves.toHaveLength(1);

    await expect(application.create(benchmarkInput({
      minAgeYears: 20,
      maxAgeYears: 29,
    }))).resolves.toMatchObject({ minAgeYears: 20 });
    await expect(application.create(benchmarkInput({
      gender: "다른 성별",
      minAgeYears: 0,
      maxAgeYears: 150,
    }))).resolves.toMatchObject({ gender: "다른 성별" });
    await expect(application.create(benchmarkInput({
      categoryId: categoryIds[1],
      minAgeYears: 0,
      maxAgeYears: 150,
    }))).resolves.toMatchObject({ categoryId: categoryIds[1] });
  });

  it("excludes the same ID on update and allows deleted ranges to be reused", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage, () => categories);
    const first = await application.create(benchmarkInput({
      minAgeYears: 0,
      maxAgeYears: 19,
    }));
    const second = await application.create(benchmarkInput({
      minAgeYears: 20,
      maxAgeYears: 29,
    }));
    await expect(application.update(first.id, benchmarkInput({
      minAgeYears: 0,
      maxAgeYears: 19,
    }))).resolves.toMatchObject({ id: first.id });
    await expect(application.update(second.id, benchmarkInput({
      minAgeYears: 19,
      maxAgeYears: 29,
    }))).rejects.toMatchObject({ code: "conflict" });

    await application.remove(first.id);
    await expect(application.create(benchmarkInput({
      minAgeYears: 0,
      maxAgeYears: 19,
    }))).resolves.toMatchObject({ minAgeYears: 0, maxAgeYears: 19 });
    const stored = JSON.parse(
      storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY) ?? "[]",
    ) as Array<{ id: string; deletedAt: string | null }>;
    expect(stored.find((row) => row.id === first.id)?.deletedAt).toBe(timestamp);
  });

  it("hides an inactive parent while preserving its child row", async () => {
    const storage = new MemoryStorage();
    let activeCategories: readonly CoverageCategory[] = categories;
    const application = createApplication(storage, () => activeCategories);
    const created = await application.create(benchmarkInput());
    activeCategories = categories.slice(1);

    await expect(application.list()).resolves.toEqual([]);
    await expect(application.update(created.id, benchmarkInput())).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(application.remove(created.id)).rejects.toMatchObject({
      code: "not_found",
    });
    await expect(application.create(benchmarkInput())).rejects.toMatchObject({
      code: "category_not_found",
    });
    const stored = JSON.parse(
      storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY) ?? "[]",
    ) as Array<{ id: string; deletedAt: string | null }>;
    expect(stored).toMatchObject([{ id: created.id, deletedAt: null }]);

    activeCategories = categories;
    await expect(application.list()).resolves.toMatchObject([{ id: created.id }]);
  });

  it("reports corrupt storage without echoing stored values", async () => {
    const storage = new MemoryStorage();
    storage.setItem(
      BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY,
      "synthetic-secret-benchmark",
    );
    const failure = createApplication(storage, () => categories).list();
    await expect(failure).rejects.toMatchObject({
      code: "storage_corrupt",
      message: "저장된 미리보기 보장 비교 기준 데이터를 읽을 수 없습니다.",
    });
    await expect(failure).rejects.not.toThrow(/synthetic-secret-benchmark/);
  });
});
