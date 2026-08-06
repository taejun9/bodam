import { describe, expect, it } from "vitest";

import {
  TauriCoverageBenchmarkRepository,
  type CoverageBenchmarkInvoke,
} from "../repositories/tauri-coverage-benchmark-repository";
import type { CoverageBenchmarkWire } from "../types/coverage-benchmark";
import {
  benchmarkIds,
  benchmarkInput,
  categoryIds,
  timestamp,
} from "./coverage-benchmark-test-data";

const wireInput = {
  categoryId: categoryIds[0],
  gender: "합성 성별",
  minAgeYears: 20,
  maxAgeYears: 29,
  adequateMinWon: "50",
  excessiveMinWon: "100",
};

const wireBenchmark = (
  id: string,
  overrides: Partial<CoverageBenchmarkWire> = {},
): CoverageBenchmarkWire => ({
  id,
  ...wireInput,
  createdAt: timestamp,
  updatedAt: timestamp,
  ...overrides,
});

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

describe("TauriCoverageBenchmarkRepository", () => {
  it("uses aligned commands, canonical money wire values, and stable sorting", async () => {
    const calls: Invocation[] = [];
    const invokeCommand: CoverageBenchmarkInvoke = <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      const responses: Record<string, unknown> = {
        list_coverage_benchmarks: [
          wireBenchmark(benchmarkIds[1], { minAgeYears: 30, maxAgeYears: 39 }),
          wireBenchmark(benchmarkIds[0]),
        ],
        create_coverage_benchmark: wireBenchmark(benchmarkIds[0]),
        update_coverage_benchmark: wireBenchmark(benchmarkIds[0], {
          adequateMinWon: "60",
        }),
        delete_coverage_benchmark: { id: benchmarkIds[0] },
      };
      return Promise.resolve(responses[command] as T);
    };
    const repository = new TauriCoverageBenchmarkRepository(invokeCommand);

    await expect(repository.list()).resolves.toMatchObject([
      { id: benchmarkIds[0] },
      { id: benchmarkIds[1] },
    ]);
    await expect(repository.create(benchmarkInput())).resolves.toMatchObject({
      adequateMinWon: 50n,
      excessiveMinWon: 100n,
    });
    await expect(repository.update(benchmarkIds[0], benchmarkInput({
      adequateMinWon: 60n,
    }))).resolves.toMatchObject({ adequateMinWon: 60n });
    await repository.remove(benchmarkIds[0]);

    expect(calls).toEqual([
      { command: "list_coverage_benchmarks", args: undefined },
      { command: "create_coverage_benchmark", args: { input: wireInput } },
      {
        command: "update_coverage_benchmark",
        args: {
          id: benchmarkIds[0],
          input: { ...wireInput, adequateMinWon: "60" },
        },
      },
      {
        command: "delete_coverage_benchmark",
        args: { id: benchmarkIds[0] },
      },
    ]);
  });

  it("maps native category, benchmark, conflict, and validation errors", async () => {
    const failingRepository = (failure: unknown) =>
      new TauriCoverageBenchmarkRepository(<T>(): Promise<T> =>
        Promise.reject(failure)
      );

    await expect(
      failingRepository({ code: "COVERAGE_CATEGORY_NOT_FOUND" }).create(
        benchmarkInput(),
      ),
    ).rejects.toMatchObject({ code: "category_not_found" });
    await expect(
      failingRepository('{"code":"COVERAGE_BENCHMARK_NOT_FOUND"}').remove(
        benchmarkIds[0],
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      failingRepository({ code: "COVERAGE_BENCHMARK_CONFLICT" }).update(
        benchmarkIds[0],
        benchmarkInput(),
      ),
    ).rejects.toMatchObject({ code: "conflict" });
    await expect(
      failingRepository({ code: "VALIDATION_ERROR" }).create(benchmarkInput()),
    ).rejects.toMatchObject({
      code: "unexpected",
      message: "입력 내용을 확인해 주세요.",
    });
  });

  it("rejects malformed native responses without exposing values", async () => {
    const repository = new TauriCoverageBenchmarkRepository(<T>(): Promise<T> =>
      Promise.resolve([{
        ...wireBenchmark(benchmarkIds[0]),
        adequateMinWon: "synthetic-secret-amount",
      }] as T)
    );

    const failure = repository.list();
    await expect(failure).rejects.toMatchObject({
      code: "unexpected",
      message: "보장 비교 기준 데이터 응답을 확인할 수 없습니다.",
    });
    await expect(failure).rejects.not.toThrow(/synthetic-secret-amount/);
  });

  it("verifies delete response identity", async () => {
    const repository = new TauriCoverageBenchmarkRepository(<T>(): Promise<T> =>
      Promise.resolve({ id: benchmarkIds[1] } as T)
    );
    await expect(repository.remove(benchmarkIds[0])).rejects.toMatchObject({
      code: "unexpected",
      message: "보장 비교 기준 삭제 응답을 확인할 수 없습니다.",
    });
  });
});
