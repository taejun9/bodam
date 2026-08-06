import { describe, expect, it } from "vitest";

import {
  TauriInsurancePolicyRepository,
  type InsuranceInvoke,
} from "../repositories/tauri-insurance-policy-repository";
import type {
  InsurancePolicyInput,
  InsurancePolicyWire,
} from "../types/insurance-policy";

const customerId = "11111111-1111-4111-8111-111111111111";
const policyId = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";

const input: InsurancePolicyInput = {
  insurer: "합성보험사",
  productName: "합성상품",
  joinedOn: "2025-01-31",
  coverageTerm: "종신",
  paymentTerm: "20년",
  monthlyPremiumWon: 123_456n,
  disclosurePlan: null,
  maturesOn: null,
  renewable: false,
  status: "합성 유지",
  isIncluded: true,
};

const wireInput = {
  ...input,
  monthlyPremiumWon: "123456",
};

const wirePolicy: InsurancePolicyWire = {
  id: policyId,
  customerId,
  ...wireInput,
  createdAt: "2026-08-06T01:02:03.000Z",
  updatedAt: "2026-08-06T01:02:03.000Z",
};

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

describe("TauriInsurancePolicyRepository", () => {
  it("uses approved commands and canonical decimal-string money payloads", async () => {
    const calls: Invocation[] = [];
    const invokeCommand: InsuranceInvoke = <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      const responses: Record<string, unknown> = {
        list_insurance_policies: [wirePolicy],
        create_insurance_policy: wirePolicy,
        update_insurance_policy: { ...wirePolicy, isIncluded: false },
        delete_insurance_policy: { id: policyId },
      };
      return Promise.resolve(responses[command] as T);
    };
    const repository = new TauriInsurancePolicyRepository(invokeCommand);

    const listed = await repository.list(customerId);
    const created = await repository.create(customerId, input);
    const updated = await repository.update(policyId, {
      ...input,
      isIncluded: false,
    });
    await repository.remove(policyId);

    expect(listed[0]?.monthlyPremiumWon).toBe(123_456n);
    expect(created.monthlyPremiumWon).toBe(123_456n);
    expect(updated.isIncluded).toBe(false);
    expect(calls).toEqual([
      {
        command: "list_insurance_policies",
        args: { customerId },
      },
      {
        command: "create_insurance_policy",
        args: { customerId, input: wireInput },
      },
      {
        command: "update_insurance_policy",
        args: { id: policyId, input: { ...wireInput, isIncluded: false } },
      },
      {
        command: "delete_insurance_policy",
        args: { id: policyId },
      },
    ]);
  });

  it("rejects malformed IPC responses without exposing their contents", async () => {
    const invokeCommand: InsuranceInvoke = <T>(): Promise<T> =>
      Promise.resolve({ monthlyPremiumWon: "synthetic-secret" } as T);
    const repository = new TauriInsurancePolicyRepository(invokeCommand);

    await expect(repository.list(customerId)).rejects.toEqual(
      expect.objectContaining({
        code: "unexpected",
        message: "보험계약 데이터 응답을 확인할 수 없습니다.",
      }),
    );
  });

  it("maps native not-found, validation, and unknown failures to safe errors", async () => {
    const failingRepository = (failure: unknown) =>
      new TauriInsurancePolicyRepository(<T>(): Promise<T> => Promise.reject(failure));

    await expect(
      failingRepository({ code: "CUSTOMER_NOT_FOUND" }).list(customerId),
    ).rejects.toMatchObject({
      code: "customer_not_found",
      message: "활성 고객을 찾을 수 없습니다.",
    });
    await expect(
      failingRepository({ code: "INSURANCE_POLICY_NOT_FOUND" }).remove(policyId),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      failingRepository({ code: "VALIDATION_ERROR" }).create(customerId, input),
    ).rejects.toMatchObject({ message: "입력 내용을 확인해 주세요." });
    await expect(
      failingRepository(new Error("synthetic database detail")).create(customerId, input),
    ).rejects.toMatchObject({
      code: "unexpected",
      message: "보험계약 데이터를 처리하지 못했습니다.",
    });
  });
});
