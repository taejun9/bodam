import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseInsuranceCustomerId,
  parseInsurancePolicyDeleteResult,
  parseInsurancePolicyId,
  parseInsurancePolicyInput,
  parseInsurancePolicyWire,
  parseInsurancePolicyWireList,
  toInsurancePolicyWireInput,
} from "../schemas/insurance-policy-schema";
import type {
  InsurancePolicy,
  InsurancePolicyInput,
} from "../types/insurance-policy";
import { InsuranceRepositoryError } from "../types/insurance-error";
import type { InsurancePolicyRepository } from "./insurance-policy-repository";

export type InsuranceInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: InsuranceInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z
  .object({ code: z.string() })
  .passthrough();

function decodeCommandError(
  error: unknown,
): z.infer<typeof commandErrorSchema> | null {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }
  return commandErrorSchema.safeParse(error).data ?? null;
}

function repositoryErrorFrom(error: unknown): InsuranceRepositoryError {
  if (error instanceof InsuranceRepositoryError) return error;

  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("customer_not_found")) {
    return new InsuranceRepositoryError(
      "활성 고객을 찾을 수 없습니다.",
      "customer_not_found",
    );
  }
  if (code.includes("policy_not_found") || code.includes("insurance_not_found")) {
    return new InsuranceRepositoryError("보험계약을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new InsuranceRepositoryError("입력 내용을 확인해 주세요.");
  }
  return new InsuranceRepositoryError("보험계약 데이터를 처리하지 못했습니다.");
}

export class TauriInsurancePolicyRepository
implements InsurancePolicyRepository {
  constructor(private readonly invokeCommand: InsuranceInvoke = defaultInvoke) {}

  async list(customerId: string): Promise<InsurancePolicy[]> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    return this.execute(async () =>
      parseInsurancePolicyWireList(
        await this.invokeCommand<unknown>("list_insurance_policies", {
          customerId: parsedCustomerId,
        }),
      ),
    );
  }

  async create(
    customerId: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    const wireInput = toInsurancePolicyWireInput(parseInsurancePolicyInput(input));
    return this.execute(async () =>
      parseInsurancePolicyWire(
        await this.invokeCommand<unknown>("create_insurance_policy", {
          customerId: parsedCustomerId,
          input: wireInput,
        }),
      ),
    );
  }

  async update(
    id: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedId = parseInsurancePolicyId(id);
    const wireInput = toInsurancePolicyWireInput(parseInsurancePolicyInput(input));
    return this.execute(async () =>
      parseInsurancePolicyWire(
        await this.invokeCommand<unknown>("update_insurance_policy", {
          id: parsedId,
          input: wireInput,
        }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseInsurancePolicyId(id);
    await this.execute(async () => {
      const result = parseInsurancePolicyDeleteResult(
        await this.invokeCommand<unknown>("delete_insurance_policy", {
          id: parsedId,
        }),
      );
      if (result.id !== parsedId) {
        throw new InsuranceRepositoryError(
          "보험계약 삭제 응답을 확인할 수 없습니다.",
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
