import { describe, expect, it } from "vitest";

import type { InsurancePolicyRepository } from "@/features/insurance/repositories/insurance-policy-repository";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import { InsuranceRepositoryError } from "@/features/insurance/types/insurance-error";

import { CoverageApplication } from "../application/coverage-application";
import {
  BrowserCoverageRepository,
} from "../repositories/browser-coverage-repository";
import {
  BROWSER_COVERAGE_CATEGORY_STORAGE_KEY,
  BROWSER_COVERAGE_STORAGE_KEY,
} from "../repositories/browser-coverage-storage";
import { INITIAL_COVERAGE_CATEGORY_SEEDS } from "../repositories/coverage-category-seed";
import {
  StoredCoverageCategorySchema,
  StoredCoverageWireSchema,
} from "../schemas/coverage-schema";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const customerId = "11111111-1111-4111-8111-111111111111";
const otherCustomerId = "11111111-1111-4111-8111-111111111112";
const policyIds = [
  "20000000-0000-4000-8000-000000000001",
  "20000000-0000-4000-8000-000000000002",
  "20000000-0000-4000-8000-000000000003",
] as const;
const coverageIds = [
  "30000000-0000-4000-8000-000000000001",
  "30000000-0000-4000-8000-000000000002",
  "30000000-0000-4000-8000-000000000003",
] as const;
const categoryIds = [
  "10000000-0000-4000-8000-000000000001",
  "10000000-0000-4000-8000-000000000002",
  "10000000-0000-4000-8000-000000000003",
] as const;
const timestamp = "2026-08-06T01:02:03.000Z";

const policy = (id: string, isIncluded: boolean): InsurancePolicy => ({
  id,
  customerId,
  insurer: "합성보험사",
  productName: "합성상품",
  joinedOn: null,
  coverageTerm: null,
  paymentTerm: null,
  monthlyPremiumWon: 10_000n,
  disclosurePlan: null,
  maturesOn: null,
  renewable: false,
  status: null,
  isIncluded,
  createdAt: timestamp,
  updatedAt: timestamp,
});

const includedPolicy = policy(policyIds[0], true);
const excludedPolicy = policy(policyIds[1], false);

function createPolicyRepository(
  policies: () => readonly InsurancePolicy[],
): Pick<InsurancePolicyRepository, "list"> {
  return {
    list: (requestedCustomerId) => {
      if (requestedCustomerId !== customerId) {
        return Promise.reject(
          new InsuranceRepositoryError(
            "활성 고객을 찾을 수 없습니다.",
            "customer_not_found",
          ),
        );
      }
      return Promise.resolve([...policies()]);
    },
  };
}

function createApplication(
  storage: MemoryStorage,
  policies: () => readonly InsurancePolicy[] = () => [
    includedPolicy,
    excludedPolicy,
  ],
): CoverageApplication {
  let idIndex = 0;
  return new CoverageApplication(
    new BrowserCoverageRepository({
      storage,
      policyRepository: createPolicyRepository(policies),
      now: () => timestamp,
      createId: () => coverageIds[idIndex++] ?? coverageIds[2],
    }),
  );
}

describe("BrowserCoverageRepository categories", () => {
  it("seeds exact categories once and persists rename and soft delete", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);

    expect(
      (await application.listCategories()).map(({ id, name }) => ({ id, name })),
    ).toEqual(INITIAL_COVERAGE_CATEGORY_SEEDS);
    await application.updateCategory(categoryIds[0], { name: "  합성 암  " });
    await application.removeCategory(categoryIds[1]);

    const reloaded = createApplication(storage);
    const categories = await reloaded.listCategories();
    expect(categories).toHaveLength(9);
    expect(categories[0]).toMatchObject({ id: categoryIds[0], name: "합성 암" });
    expect(categories.some((category) => category.id === categoryIds[1])).toBe(false);

    const stored = StoredCoverageCategorySchema.array().parse(
      JSON.parse(storage.getItem(BROWSER_COVERAGE_CATEGORY_STORAGE_KEY) ?? "[]"),
    );
    expect(stored).toHaveLength(10);
    expect(stored.find((category) => category.id === categoryIds[1])?.deletedAt)
      .toBe(timestamp);
  });
});

describe("BrowserCoverageRepository coverage lifecycle", () => {
  it("keeps excluded-policy rows manageable and applies soft-delete visibility", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);

    const first = await application.create(customerId, policyIds[0], {
      categoryId: categoryIds[0],
      amountWon: 100n,
    });
    const second = await application.create(customerId, policyIds[1], {
      categoryId: categoryIds[0],
      amountWon: 200n,
    });
    const listed = await application.list(customerId);
    expect(listed).toHaveLength(2);
    expect(
      application.summary(
        await application.listCategories(),
        [includedPolicy, excludedPolicy],
        listed,
      ),
    ).toMatchObject([{ amountWon: 100n, coverageCount: 1 }]);

    const updated = await application.update(customerId, first.id, {
      categoryId: categoryIds[2],
      amountWon: 9_223_372_036_854_775_807n,
    });
    expect(updated).toMatchObject({
      policyId: policyIds[0],
      categoryId: categoryIds[2],
      amountWon: 9_223_372_036_854_775_807n,
    });
    await application.remove(customerId, second.id);
    await expect(application.list(customerId)).resolves.toEqual([updated]);

    await application.removeCategory(categoryIds[2]);
    await expect(application.list(customerId)).resolves.toEqual([]);

    const stored = StoredCoverageWireSchema.array().parse(
      JSON.parse(storage.getItem(BROWSER_COVERAGE_STORAGE_KEY) ?? "[]"),
    );
    expect(stored).toHaveLength(2);
    expect(stored[0]).toMatchObject({
      id: first.id,
      policyId: policyIds[0],
      amountWon: "9223372036854775807",
      deletedAt: null,
    });
    expect(stored[1]).toMatchObject({ id: second.id, deletedAt: timestamp });
  });

  it("enforces active customers, policies, and categories without deleting rows", async () => {
    const storage = new MemoryStorage();
    let activePolicies: readonly InsurancePolicy[] = [includedPolicy];
    const application = createApplication(storage, () => activePolicies);
    const created = await application.create(customerId, policyIds[0], {
      categoryId: categoryIds[0],
      amountWon: 10n,
    });

    await expect(
      application.create(customerId, policyIds[2], {
        categoryId: categoryIds[0],
        amountWon: 10n,
      }),
    ).rejects.toMatchObject({ code: "policy_not_found" });
    await application.removeCategory(categoryIds[1]);
    await expect(
      application.update(customerId, created.id, {
        categoryId: categoryIds[1],
        amountWon: 10n,
      }),
    ).rejects.toMatchObject({ code: "category_not_found" });
    await expect(application.list(otherCustomerId)).rejects.toMatchObject({
      code: "customer_not_found",
    });

    activePolicies = [];
    await expect(
      application.update(customerId, created.id, {
        categoryId: categoryIds[0],
        amountWon: 11n,
      }),
    ).rejects.toMatchObject({ code: "not_found" });
    await expect(application.remove(customerId, created.id)).rejects.toMatchObject({
      code: "not_found",
    });
    const stored = StoredCoverageWireSchema.array().parse(
      JSON.parse(storage.getItem(BROWSER_COVERAGE_STORAGE_KEY) ?? "[]"),
    );
    expect(stored).toMatchObject([{ id: created.id, deletedAt: null }]);
  });

  it("reports corrupt synthetic storage without exposing stored contents", async () => {
    const categoryStorage = new MemoryStorage();
    categoryStorage.setItem(
      BROWSER_COVERAGE_CATEGORY_STORAGE_KEY,
      "synthetic-secret-category",
    );
    await expect(createApplication(categoryStorage).listCategories()).rejects.toMatchObject({
      code: "storage_corrupt",
      message: "저장된 미리보기 카테고리 데이터를 읽을 수 없습니다.",
    });

    const coverageStorage = new MemoryStorage();
    coverageStorage.setItem(BROWSER_COVERAGE_STORAGE_KEY, "synthetic-secret-coverage");
    await expect(createApplication(coverageStorage).list(customerId)).rejects.toMatchObject({
      code: "storage_corrupt",
      message: "저장된 미리보기 보장 데이터를 읽을 수 없습니다.",
    });
  });
});
