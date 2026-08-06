import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseCoverageBenchmarkDeleteResult,
  parseCoverageBenchmarkId,
  parseCoverageBenchmarkInput,
  parseCoverageBenchmarkWire,
  parseCoverageBenchmarkWireList,
  toCoverageBenchmarkWireInput,
} from "../schemas/coverage-benchmark-schema";
import { sortCoverageBenchmarks } from "../services/coverage-benchmark-rules";
import type {
  CoverageBenchmark,
  CoverageBenchmarkInput,
} from "../types/coverage-benchmark";
import { CoverageBenchmarkRepositoryError } from "../types/coverage-benchmark-error";
import type { CoverageBenchmarkRepository } from "./coverage-benchmark-repository";

export type CoverageBenchmarkInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: CoverageBenchmarkInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

function decodeCommandError(error: unknown): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}

function repositoryErrorFrom(error: unknown): CoverageBenchmarkRepositoryError {
  if (error instanceof CoverageBenchmarkRepositoryError) return error;
  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("coverage_benchmark_not_found")) {
    return new CoverageBenchmarkRepositoryError(
      "보장 비교 기준을 찾을 수 없습니다.",
      "not_found",
    );
  }
  if (code.includes("coverage_category_not_found") ||
      code.includes("category_not_found")) {
    return new CoverageBenchmarkRepositoryError(
      "활성 보장 카테고리를 찾을 수 없습니다.",
      "category_not_found",
    );
  }
  if (code.includes("coverage_benchmark_conflict") || code.includes("conflict")) {
    return new CoverageBenchmarkRepositoryError(
      "같은 성별과 겹치는 나이 구간의 기준이 있습니다.",
      "conflict",
    );
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new CoverageBenchmarkRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new CoverageBenchmarkRepositoryError(
    "보장 비교 기준 데이터를 처리하지 못했습니다.",
  );
}

export class TauriCoverageBenchmarkRepository
implements CoverageBenchmarkRepository {
  constructor(
    private readonly invokeCommand: CoverageBenchmarkInvoke = defaultInvoke,
  ) {}

  async list(): Promise<CoverageBenchmark[]> {
    return this.execute(async () => sortCoverageBenchmarks(
      parseCoverageBenchmarkWireList(
        await this.invokeCommand<unknown>("list_coverage_benchmarks"),
      ),
    ));
  }

  async create(input: CoverageBenchmarkInput): Promise<CoverageBenchmark> {
    const wireInput = toCoverageBenchmarkWireInput(
      parseCoverageBenchmarkInput(input),
    );
    return this.execute(async () => parseCoverageBenchmarkWire(
      await this.invokeCommand<unknown>("create_coverage_benchmark", {
        input: wireInput,
      }),
    ));
  }

  async update(
    id: string,
    input: CoverageBenchmarkInput,
  ): Promise<CoverageBenchmark> {
    const parsedId = parseCoverageBenchmarkId(id);
    const wireInput = toCoverageBenchmarkWireInput(
      parseCoverageBenchmarkInput(input),
    );
    return this.execute(async () => parseCoverageBenchmarkWire(
      await this.invokeCommand<unknown>("update_coverage_benchmark", {
        id: parsedId,
        input: wireInput,
      }),
    ));
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseCoverageBenchmarkId(id);
    await this.execute(async () => {
      const result = parseCoverageBenchmarkDeleteResult(
        await this.invokeCommand<unknown>("delete_coverage_benchmark", {
          id: parsedId,
        }),
      );
      if (result.id !== parsedId) {
        throw new CoverageBenchmarkRepositoryError(
          "보장 비교 기준 삭제 응답을 확인할 수 없습니다.",
        );
      }
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw repositoryErrorFrom(error);
    }
  }
}
