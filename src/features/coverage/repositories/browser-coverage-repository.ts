import { BrowserInsurancePolicyRepository } from "@/features/insurance/repositories/browser-insurance-policy-repository";
import type { InsurancePolicyRepository } from "@/features/insurance/repositories/insurance-policy-repository";
import { InsuranceRepositoryError } from "@/features/insurance/types/insurance-error";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import { withBrowserStorageMutation } from "@/shared/browser-storage-mutation";

import {
  parseCoverageCategoryId,
  parseCoverageCategoryInput,
  parseCoverageCustomerId,
  parseCoverageId,
  parseCoverageInput,
  parseCoveragePolicyId,
  toCoverageWireInput,
} from "../schemas/coverage-schema";
import type {
  Coverage,
  CoverageCategory,
  CoverageCategoryInput,
  CoverageInput,
} from "../types/coverage";
import { CoverageRepositoryError } from "../types/coverage-error";
import {
  categoryFromStored,
  coverageFromStored,
  parseStoredCategory,
  parseStoredCoverage,
} from "./browser-coverage-mapping";
import {
  BrowserCoverageStorage,
  type CoverageStoragePort,
  type StoredCoverageCategory,
} from "./browser-coverage-storage";
import type { CoverageRepository } from "./coverage-repository";

export interface BrowserCoverageRepositoryOptions {
  readonly storage?: CoverageStoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly policyRepository?: Pick<InsurancePolicyRepository, "list">;
}

const defaultStorage = (): CoverageStoragePort => {
  if (typeof window === "undefined") {
    throw new CoverageRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const defaultNow = (): string => new Date().toISOString();
const defaultCreateId = (): string => globalThis.crypto.randomUUID();

const categoryNotFound = (): CoverageRepositoryError =>
  new CoverageRepositoryError("보장 카테고리를 찾을 수 없습니다.", "category_not_found");
const coverageNotFound = (): CoverageRepositoryError =>
  new CoverageRepositoryError("보장을 찾을 수 없습니다.", "not_found");
const policyNotFound = (): CoverageRepositoryError =>
  new CoverageRepositoryError("활성 보험계약을 찾을 수 없습니다.", "policy_not_found");

export class BrowserCoverageRepository implements CoverageRepository {
  private readonly store: BrowserCoverageStorage;
  private readonly storage: CoverageStoragePort;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly policyRepository: Pick<InsurancePolicyRepository, "list">;

  constructor(options: BrowserCoverageRepositoryOptions = {}) {
    const storage = options.storage ?? defaultStorage();
    this.storage = storage;
    this.now = options.now ?? defaultNow;
    this.createId = options.createId ?? defaultCreateId;
    this.store = new BrowserCoverageStorage(storage, this.now);
    this.policyRepository = options.policyRepository
      ?? new BrowserInsurancePolicyRepository({ storage });
  }

  async listCategories(): Promise<CoverageCategory[]> {
    return this.activeCategories().map(categoryFromStored);
  }

  async updateCategory(
    id: string,
    input: CoverageCategoryInput,
  ): Promise<CoverageCategory> {
    const parsedId = parseCoverageCategoryId(id);
    const parsedInput = parseCoverageCategoryInput(input);
    return withBrowserStorageMutation(this.storage, async () => {
      const categories = this.store.loadCategories();
      const index = categories.findIndex(
        (category) => category.id === parsedId && category.deletedAt === null,
      );
      const existing = categories[index];
      if (index < 0 || existing === undefined) throw categoryNotFound();
      const updated = parseStoredCategory({
        ...existing,
        ...parsedInput,
        updatedAt: this.now(),
      });
      categories[index] = updated;
      this.store.saveCategories(categories);
      return categoryFromStored(updated);
    });
  }

  async removeCategory(id: string): Promise<void> {
    const parsedId = parseCoverageCategoryId(id);
    await withBrowserStorageMutation(this.storage, async () => {
      const categories = this.store.loadCategories();
      const index = categories.findIndex(
        (category) => category.id === parsedId && category.deletedAt === null,
      );
      const existing = categories[index];
      if (index < 0 || existing === undefined) throw categoryNotFound();
      const timestamp = this.now();
      categories[index] = parseStoredCategory({
        ...existing,
        updatedAt: timestamp,
        deletedAt: timestamp,
      });
      this.store.saveCategories(categories);
    });
  }

  async list(customerId: string): Promise<Coverage[]> {
    const policies = await this.activePolicies(parseCoverageCustomerId(customerId));
    const policyIds = new Set(policies.map((policy) => policy.id));
    const categoryIds = new Set(this.activeCategories().map((category) => category.id));
    return this.store.loadCoverages()
      .filter(
        (coverage) =>
          coverage.deletedAt === null &&
          policyIds.has(coverage.policyId) &&
          categoryIds.has(coverage.categoryId),
      )
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
      )
      .map(coverageFromStored);
  }

  async create(
    customerId: string,
    policyId: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const policies = await this.activePolicies(parseCoverageCustomerId(customerId));
    const parsedPolicyId = parseCoveragePolicyId(policyId);
    const parsedInput = parseCoverageInput(input);
    if (!policies.some((policy) => policy.id === parsedPolicyId)) throw policyNotFound();
    this.ensureActiveCategory(parsedInput.categoryId);

    const coverages = this.store.loadCoverages();
    const id = this.createId();
    if (coverages.some((coverage) => coverage.id === id)) {
      throw new CoverageRepositoryError("보장 식별자를 생성하지 못했습니다.");
    }
    const timestamp = this.now();
    const stored = parseStoredCoverage({
      id,
      policyId: parsedPolicyId,
      ...toCoverageWireInput(parsedInput),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.saveCoverages([...coverages, stored]);
    return coverageFromStored(stored);
  }

  async update(
    customerId: string,
    id: string,
    input: CoverageInput,
  ): Promise<Coverage> {
    const policies = await this.activePolicies(parseCoverageCustomerId(customerId));
    const parsedId = parseCoverageId(id);
    const parsedInput = parseCoverageInput(input);
    const policyIds = new Set(policies.map((policy) => policy.id));
    const coverages = this.store.loadCoverages();
    const index = coverages.findIndex(
      (coverage) => coverage.id === parsedId && coverage.deletedAt === null,
    );
    const existing = coverages[index];
    if (
      index < 0 || existing === undefined || !policyIds.has(existing.policyId) ||
      !this.isActiveCategory(existing.categoryId)
    ) throw coverageNotFound();
    this.ensureActiveCategory(parsedInput.categoryId);
    const updated = parseStoredCoverage({
      ...existing,
      ...toCoverageWireInput(parsedInput),
      updatedAt: this.now(),
    });
    coverages[index] = updated;
    this.store.saveCoverages(coverages);
    return coverageFromStored(updated);
  }

  async remove(customerId: string, id: string): Promise<void> {
    const policies = await this.activePolicies(parseCoverageCustomerId(customerId));
    const parsedId = parseCoverageId(id);
    const policyIds = new Set(policies.map((policy) => policy.id));
    const coverages = this.store.loadCoverages();
    const index = coverages.findIndex(
      (coverage) => coverage.id === parsedId && coverage.deletedAt === null,
    );
    const existing = coverages[index];
    if (
      index < 0 || existing === undefined || !policyIds.has(existing.policyId) ||
      !this.isActiveCategory(existing.categoryId)
    ) throw coverageNotFound();
    const timestamp = this.now();
    coverages[index] = parseStoredCoverage({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.saveCoverages(coverages);
  }

  private activeCategories(): StoredCoverageCategory[] {
    return this.store.loadCategories()
      .filter((category) => category.deletedAt === null)
      .sort((left, right) => left.id.localeCompare(right.id));
  }

  private isActiveCategory(id: string): boolean {
    return this.activeCategories().some((category) => category.id === id);
  }

  private ensureActiveCategory(id: string): void {
    if (!this.isActiveCategory(id)) throw categoryNotFound();
  }

  private async activePolicies(customerId: string): Promise<InsurancePolicy[]> {
    try {
      return await this.policyRepository.list(customerId);
    } catch (error) {
      if (error instanceof InsuranceRepositoryError && error.code === "customer_not_found") {
        throw new CoverageRepositoryError(
          "활성 고객을 찾을 수 없습니다.",
          "customer_not_found",
        );
      }
      throw new CoverageRepositoryError("활성 고객과 보험계약을 확인할 수 없습니다.");
    }
  }
}
