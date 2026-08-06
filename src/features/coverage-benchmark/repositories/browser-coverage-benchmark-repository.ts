import { BrowserCoverageRepository } from "@/features/coverage/repositories/browser-coverage-repository";
import type { CoverageRepository } from "@/features/coverage/repositories/coverage-repository";
import { withBrowserStorageMutation } from "@/shared/browser-storage-mutation";

import {
  parseCoverageBenchmarkId,
  parseCoverageBenchmarkInput,
  toCoverageBenchmarkWireInput,
} from "../schemas/coverage-benchmark-schema";
import {
  coverageBenchmarkRangesOverlap,
  sortCoverageBenchmarks,
} from "../services/coverage-benchmark-rules";
import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";
import { CoverageBenchmarkRepositoryError } from "../types/coverage-benchmark-error";
import {
  coverageBenchmarkFromStored,
  parseStoredCoverageBenchmark,
} from "./browser-coverage-benchmark-mapping";
import {
  BrowserCoverageBenchmarkStorage,
  type CoverageBenchmarkStoragePort,
  type StoredCoverageBenchmarkWire,
} from "./browser-coverage-benchmark-storage";
import type { CoverageBenchmarkRepository } from "./coverage-benchmark-repository";

export interface BrowserCoverageBenchmarkRepositoryOptions {
  readonly storage?: CoverageBenchmarkStoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly coverageRepository?: Pick<CoverageRepository, "listCategories">;
}

const defaultStorage = (): CoverageBenchmarkStoragePort => {
  if (typeof window === "undefined") {
    throw new CoverageBenchmarkRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const benchmarkNotFound = (): CoverageBenchmarkRepositoryError =>
  new CoverageBenchmarkRepositoryError(
    "보장 비교 기준을 찾을 수 없습니다.",
    "not_found",
  );

const categoryNotFound = (): CoverageBenchmarkRepositoryError =>
  new CoverageBenchmarkRepositoryError(
    "활성 보장 카테고리를 찾을 수 없습니다.",
    "category_not_found",
  );

const benchmarkConflict = (): CoverageBenchmarkRepositoryError =>
  new CoverageBenchmarkRepositoryError(
    "같은 성별과 겹치는 나이 구간의 기준이 있습니다.",
    "conflict",
  );

export class BrowserCoverageBenchmarkRepository
implements CoverageBenchmarkRepository {
  private readonly store: BrowserCoverageBenchmarkStorage;
  private readonly storage: CoverageBenchmarkStoragePort;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly coverageRepository: Pick<CoverageRepository, "listCategories">;

  constructor(options: BrowserCoverageBenchmarkRepositoryOptions = {}) {
    const storage = options.storage ?? defaultStorage();
    this.storage = storage;
    this.store = new BrowserCoverageBenchmarkStorage(storage);
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    this.coverageRepository = options.coverageRepository ??
      new BrowserCoverageRepository({ storage });
  }

  list(): Promise<CoverageBenchmark[]> {
    return withBrowserStorageMutation(this.storage, () => this.listUnlocked());
  }

  private async listUnlocked(): Promise<CoverageBenchmark[]> {
    const categoryIds = await this.activeCategoryIds();
    return sortCoverageBenchmarks(
      this.store.load()
        .filter((benchmark) =>
          benchmark.deletedAt === null && categoryIds.has(benchmark.categoryId)
        )
        .map(coverageBenchmarkFromStored),
    );
  }

  create(input: CoverageBenchmarkInput): Promise<CoverageBenchmark> {
    return withBrowserStorageMutation(
      this.storage,
      () => this.createUnlocked(input),
    );
  }

  update(
    id: string,
    input: CoverageBenchmarkInput,
  ): Promise<CoverageBenchmark> {
    return withBrowserStorageMutation(
      this.storage,
      () => this.updateUnlocked(id, input),
    );
  }

  remove(id: string): Promise<void> {
    return withBrowserStorageMutation(
      this.storage,
      () => this.removeUnlocked(id),
    );
  }

  private async createUnlocked(
    input: CoverageBenchmarkInput,
  ): Promise<CoverageBenchmark> {
    const parsedInput = parseCoverageBenchmarkInput(input);
    const categoryIds = await this.activeCategoryIds();
    if (!categoryIds.has(parsedInput.categoryId)) throw categoryNotFound();
    const benchmarks = this.store.load();
    this.ensureNoOverlap(benchmarks, parsedInput);
    const id = this.createId();
    if (benchmarks.some((benchmark) => benchmark.id === id)) {
      throw new CoverageBenchmarkRepositoryError(
        "보장 비교 기준 식별자를 생성하지 못했습니다.",
      );
    }
    const timestamp = this.now();
    const created = parseStoredCoverageBenchmark({
      id,
      ...toCoverageBenchmarkWireInput(parsedInput),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.save([...benchmarks, created]);
    return coverageBenchmarkFromStored(created);
  }

  private async updateUnlocked(
    id: string,
    input: CoverageBenchmarkInput,
  ): Promise<CoverageBenchmark> {
    const parsedId = parseCoverageBenchmarkId(id);
    const parsedInput = parseCoverageBenchmarkInput(input);
    const benchmarks = this.store.load();
    const index = benchmarks.findIndex((benchmark) =>
      benchmark.id === parsedId && benchmark.deletedAt === null
    );
    const existing = benchmarks[index];
    if (index < 0 || existing === undefined) throw benchmarkNotFound();
    const categoryIds = await this.activeCategoryIds();
    if (!categoryIds.has(existing.categoryId)) throw benchmarkNotFound();
    if (!categoryIds.has(parsedInput.categoryId)) throw categoryNotFound();
    this.ensureNoOverlap(benchmarks, parsedInput, parsedId);
    const updated = parseStoredCoverageBenchmark({
      ...existing,
      ...toCoverageBenchmarkWireInput(parsedInput),
      updatedAt: this.now(),
    });
    benchmarks[index] = updated;
    this.store.save(benchmarks);
    return coverageBenchmarkFromStored(updated);
  }

  private async removeUnlocked(id: string): Promise<void> {
    const parsedId = parseCoverageBenchmarkId(id);
    const benchmarks = this.store.load();
    const index = benchmarks.findIndex((benchmark) =>
      benchmark.id === parsedId && benchmark.deletedAt === null
    );
    const existing = benchmarks[index];
    if (index < 0 || existing === undefined) throw benchmarkNotFound();
    const categoryIds = await this.activeCategoryIds();
    if (!categoryIds.has(existing.categoryId)) throw benchmarkNotFound();
    const timestamp = this.now();
    benchmarks[index] = parseStoredCoverageBenchmark({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.save(benchmarks);
  }

  private async activeCategoryIds(): Promise<Set<string>> {
    try {
      return new Set(
        (await this.coverageRepository.listCategories()).map((category) => category.id),
      );
    } catch {
      throw new CoverageBenchmarkRepositoryError(
        "활성 보장 카테고리를 확인할 수 없습니다.",
      );
    }
  }

  private ensureNoOverlap(
    benchmarks: readonly StoredCoverageBenchmarkWire[],
    input: CoverageBenchmarkInput,
    excludedId?: string,
  ): void {
    const overlaps = benchmarks.some((benchmark) =>
      benchmark.deletedAt === null &&
      benchmark.id !== excludedId &&
      benchmark.categoryId === input.categoryId &&
      benchmark.gender === input.gender &&
      coverageBenchmarkRangesOverlap(benchmark, input)
    );
    if (overlaps) throw benchmarkConflict();
  }
}
