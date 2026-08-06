import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseCoverageCategory,
  parseCoverageCategoryId,
  parseCoverageCategoryInput,
  parseCoverageCategoryList,
  parseCoverageCustomerId,
  parseCoverageDeleteResult,
  parseCoverageId,
  parseCoverageInput,
  parseCoveragePolicyId,
  parseCoverageWire,
  parseCoverageWireList,
  toCoverageWireInput,
} from "../schemas/coverage-schema";
import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
  CoverageInput,
} from "../types/coverage";
import { CoverageRepositoryError } from "../types/coverage-error";
import type { CoverageRepository } from "./coverage-repository";

export type CoverageInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: CoverageInvoke = <T>(
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

function repositoryErrorFrom(error: unknown): CoverageRepositoryError {
  if (error instanceof CoverageRepositoryError) return error;

  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("customer_not_found")) {
    return new CoverageRepositoryError(
      "활성 고객을 찾을 수 없습니다.",
      "customer_not_found",
    );
  }
  if (code.includes("insurance_policy_not_found") || code.includes("policy_not_found")) {
    return new CoverageRepositoryError(
      "활성 보험계약을 찾을 수 없습니다.",
      "policy_not_found",
    );
  }
  if (code.includes("category_not_found")) {
    return new CoverageRepositoryError(
      "보장 카테고리를 찾을 수 없습니다.",
      "category_not_found",
    );
  }
  if (code.includes("coverage_not_found")) {
    return new CoverageRepositoryError("보장을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new CoverageRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new CoverageRepositoryError("보장 데이터를 처리하지 못했습니다.");
}

export class TauriCoverageRepository implements CoverageRepository {
  constructor(private readonly invokeCommand: CoverageInvoke = defaultInvoke) {}

  async listCategories(): Promise<CoverageCategory[]> {
    return this.execute(async () =>
      parseCoverageCategoryList(
        await this.invokeCommand<unknown>("list_coverage_categories"),
      ),
    );
  }

  async updateCategory(
    id: string,
    input: CoverageCategoryInput,
  ): Promise<CoverageCategory> {
    const parsedId = parseCoverageCategoryId(id);
    const parsedInput = parseCoverageCategoryInput(input);
    return this.execute(async () =>
      parseCoverageCategory(
        await this.invokeCommand<unknown>("update_coverage_category", {
          id: parsedId,
          input: parsedInput,
        }),
      ),
    );
  }

  async removeCategory(id: string): Promise<void> {
    const parsedId = parseCoverageCategoryId(id);
    await this.execute(async () => {
      const result = parseCoverageDeleteResult(
        await this.invokeCommand<unknown>("delete_coverage_category", {
          id: parsedId,
        }),
      );
      if (result.id !== parsedId) {
        throw new CoverageRepositoryError("보장 카테고리 삭제 응답을 확인할 수 없습니다.");
      }
    });
  }

  async list(customerId: string): Promise<Coverage[]> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    return this.execute(async () =>
      parseCoverageWireList(
        await this.invokeCommand<unknown>("list_coverages", {
          customerId: parsedCustomerId,
        }),
      ),
    );
  }

  async create(
    customerId: string,
    policyId: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    const parsedPolicyId = parseCoveragePolicyId(policyId);
    const wireInput = toCoverageWireInput(parseCoverageInput(input));
    return this.execute(async () =>
      parseCoverageWire(
        await this.invokeCommand<unknown>("create_coverage", {
          customerId: parsedCustomerId,
          policyId: parsedPolicyId,
          input: wireInput,
        }),
      ),
    );
  }

  async update(
    customerId: string,
    id: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    const parsedId = parseCoverageId(id);
    const wireInput = toCoverageWireInput(parseCoverageInput(input));
    return this.execute(async () =>
      parseCoverageWire(
        await this.invokeCommand<unknown>("update_coverage", {
          customerId: parsedCustomerId,
          id: parsedId,
          input: wireInput,
        }),
      ),
    );
  }

  async remove(customerId: string, id: string): Promise<void> {
    const parsedCustomerId = parseCoverageCustomerId(customerId);
    const parsedId = parseCoverageId(id);
    await this.execute(async () => {
      const result = parseCoverageDeleteResult(
        await this.invokeCommand<unknown>("delete_coverage", {
          customerId: parsedCustomerId,
          id: parsedId,
        }),
      );
      if (result.id !== parsedId) {
        throw new CoverageRepositoryError("보장 삭제 응답을 확인할 수 없습니다.");
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
