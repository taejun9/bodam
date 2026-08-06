import { describe, expect, it } from "vitest";

import { BrowserCoverageRepository } from "@/features/coverage/repositories/browser-coverage-repository";
import type { CoverageRepository } from "@/features/coverage/repositories/coverage-repository";

import { CoverageBenchmarkApplication } from "../application/coverage-benchmark-application";
import { BrowserCoverageBenchmarkRepository } from "../repositories/browser-coverage-benchmark-repository";
import {
  BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY,
  type CoverageBenchmarkStoragePort,
} from "../repositories/browser-coverage-benchmark-storage";
import {
  benchmarkIds,
  benchmarkInput,
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

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

describe("shared Browser coverage mutation lock", () => {
  it("serializes overlapping writes from multiple Benchmark repositories", async () => {
    const storage = new MemoryStorage();
    const categories = new BrowserCoverageRepository({ storage, now: () => timestamp });
    await categories.listCategories();
    const firstRead = deferred();
    const releaseFirstRead = deferred();
    let categoryReads = 0;
    const delayedCategories: Pick<CoverageRepository, "listCategories"> = {
      listCategories: async () => {
        categoryReads += 1;
        const snapshot = await categories.listCategories();
        if (categoryReads === 1) {
          firstRead.resolve();
          await releaseFirstRead.promise;
        }
        return snapshot;
      },
    };
    const first = new CoverageBenchmarkApplication(
      new BrowserCoverageBenchmarkRepository({
        storage,
        coverageRepository: delayedCategories,
        now: () => timestamp,
        createId: () => benchmarkIds[0],
      }),
    );
    const second = new CoverageBenchmarkApplication(
      new BrowserCoverageBenchmarkRepository({
        storage,
        coverageRepository: delayedCategories,
        now: () => timestamp,
        createId: () => benchmarkIds[1],
      }),
    );

    const firstWrite = first.create(benchmarkInput());
    await firstRead.promise;
    const secondWrite = second.create(benchmarkInput());
    await Promise.resolve();
    expect(categoryReads).toBe(1);
    releaseFirstRead.resolve();

    await expect(firstWrite).resolves.toMatchObject({ id: benchmarkIds[0] });
    await expect(secondWrite).rejects.toMatchObject({ code: "conflict" });
    await expect(first.list()).resolves.toHaveLength(1);
  });

  it("keeps Category update/delete outside an active Benchmark snapshot-write", async () => {
    const storage = new MemoryStorage();
    const categories = new BrowserCoverageRepository({ storage, now: () => timestamp });
    await categories.listCategories();
    const categoryRead = deferred();
    const releaseCategoryRead = deferred();
    let shouldWait = true;
    const delayedCategories: Pick<CoverageRepository, "listCategories"> = {
      listCategories: async () => {
        const snapshot = await categories.listCategories();
        if (shouldWait) {
          shouldWait = false;
          categoryRead.resolve();
          await releaseCategoryRead.promise;
        }
        return snapshot;
      },
    };
    const benchmarks = new CoverageBenchmarkApplication(
      new BrowserCoverageBenchmarkRepository({
        storage,
        coverageRepository: delayedCategories,
        now: () => timestamp,
        createId: () => benchmarkIds[0],
      }),
    );

    const create = benchmarks.create(benchmarkInput());
    await categoryRead.promise;
    let updateFinished = false;
    let deleteFinished = false;
    const update = categories.updateCategory(categoryIds[0], { name: "합성 수정" })
      .then(() => { updateFinished = true; });
    const remove = categories.removeCategory(categoryIds[0])
      .then(() => { deleteFinished = true; });
    await Promise.resolve();
    expect({ updateFinished, deleteFinished }).toEqual({
      updateFinished: false,
      deleteFinished: false,
    });

    releaseCategoryRead.resolve();
    await create;
    await Promise.all([update, remove]);
    await expect(benchmarks.list()).resolves.toEqual([]);
    const stored = JSON.parse(
      storage.getItem(BROWSER_COVERAGE_BENCHMARK_STORAGE_KEY) ?? "[]",
    ) as Array<{ categoryId: string; deletedAt: string | null }>;
    expect(stored).toMatchObject([{
      categoryId: categoryIds[0],
      deletedAt: null,
    }]);
  });
});
