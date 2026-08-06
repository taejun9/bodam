import { describe, expect, it } from "vitest";

import {
  TauriCoverageRepository,
  type CoverageInvoke,
} from "../repositories/tauri-coverage-repository";
import type {
  CoverageCategory,
  CoverageInput,
  CoverageWire,
} from "../types/coverage";

const customerId = "11111111-1111-4111-8111-111111111111";
const policyId = "20000000-0000-4000-8000-000000000001";
const categoryId = "10000000-0000-4000-8000-000000000001";
const coverageId = "30000000-0000-4000-8000-000000000001";
const timestamp = "2026-08-06T01:02:03.000Z";

const category: CoverageCategory = {
  id: categoryId,
  name: "암",
  createdAt: timestamp,
  updatedAt: timestamp,
};

const input: CoverageInput = {
  categoryId,
  amountWon: 123_456n,
};

const wireInput = {
  categoryId,
  amountWon: "123456",
};

const wireCoverage: CoverageWire = {
  id: coverageId,
  policyId,
  ...wireInput,
  createdAt: timestamp,
  updatedAt: timestamp,
};

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

describe("TauriCoverageRepository", () => {
  it("uses the native command contract and canonical decimal-string amounts", async () => {
    const calls: Invocation[] = [];
    const invokeCommand: CoverageInvoke = <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      const responses: Record<string, unknown> = {
        list_coverage_categories: [category],
        update_coverage_category: { ...category, name: "합성 암" },
        delete_coverage_category: { id: categoryId },
        list_coverages: [wireCoverage],
        create_coverage: wireCoverage,
        update_coverage: { ...wireCoverage, amountWon: "9" },
        delete_coverage: { id: coverageId },
      };
      return Promise.resolve(responses[command] as T);
    };
    const repository = new TauriCoverageRepository(invokeCommand);

    await expect(repository.listCategories()).resolves.toEqual([category]);
    await expect(
      repository.updateCategory(categoryId, { name: "  합성 암  " }),
    ).resolves.toMatchObject({ name: "합성 암" });
    await repository.removeCategory(categoryId);
    await expect(repository.list(customerId)).resolves.toMatchObject([
      { amountWon: 123_456n },
    ]);
    await expect(repository.create(customerId, policyId, input)).resolves.toMatchObject({
      amountWon: 123_456n,
    });
    await expect(
      repository.update(customerId, coverageId, { ...input, amountWon: 9n }),
    ).resolves.toMatchObject({ amountWon: 9n, policyId });
    await repository.remove(customerId, coverageId);

    expect(calls).toEqual([
      { command: "list_coverage_categories", args: undefined },
      {
        command: "update_coverage_category",
        args: { id: categoryId, input: { name: "합성 암" } },
      },
      { command: "delete_coverage_category", args: { id: categoryId } },
      { command: "list_coverages", args: { customerId } },
      {
        command: "create_coverage",
        args: { customerId, policyId, input: wireInput },
      },
      {
        command: "update_coverage",
        args: {
          customerId,
          id: coverageId,
          input: { ...wireInput, amountWon: "9" },
        },
      },
      { command: "delete_coverage", args: { customerId, id: coverageId } },
    ]);
  });

  it("rejects malformed native responses without exposing their contents", async () => {
    const repository = new TauriCoverageRepository(<T>(): Promise<T> =>
      Promise.resolve([{ amountWon: "synthetic-secret-value" }] as T),
    );

    const failure = repository.list(customerId);
    await expect(failure).rejects.toMatchObject({
      code: "unexpected",
      message: "보장 데이터 응답을 확인할 수 없습니다.",
    });
    await expect(failure).rejects.not.toThrow(/synthetic-secret-value/);
  });

  it("maps native not-found, validation, string, and unknown errors safely", async () => {
    const failingRepository = (failure: unknown) =>
      new TauriCoverageRepository(<T>(): Promise<T> => Promise.reject(failure));

    await expect(
      failingRepository({ code: "CUSTOMER_NOT_FOUND" }).list(customerId),
    ).rejects.toMatchObject({ code: "customer_not_found" });
    await expect(
      failingRepository({ code: "INSURANCE_POLICY_NOT_FOUND" }).create(
        customerId,
        policyId,
        input,
      ),
    ).rejects.toMatchObject({ code: "policy_not_found" });
    await expect(
      failingRepository({ code: "COVERAGE_CATEGORY_NOT_FOUND" }).updateCategory(
        categoryId,
        { name: "암" },
      ),
    ).rejects.toMatchObject({ code: "category_not_found" });
    await expect(
      failingRepository('{"code":"COVERAGE_NOT_FOUND"}').remove(
        customerId,
        coverageId,
      ),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(
      failingRepository({ code: "VALIDATION_ERROR" }).create(
        customerId,
        policyId,
        input,
      ),
    ).rejects.toMatchObject({ message: "입력 내용을 확인해 주세요." });
    await expect(
      failingRepository(new Error("synthetic database detail")).list(customerId),
    ).rejects.toMatchObject({
      code: "unexpected",
      message: "보장 데이터를 처리하지 못했습니다.",
    });
  });

  it("verifies that delete responses match the requested ID", async () => {
    const repository = new TauriCoverageRepository(<T>(): Promise<T> =>
      Promise.resolve({ id: "30000000-0000-4000-8000-000000000002" } as T),
    );

    await expect(repository.remove(customerId, coverageId)).rejects.toMatchObject({
      code: "unexpected",
      message: "보장 삭제 응답을 확인할 수 없습니다.",
    });
  });
});
