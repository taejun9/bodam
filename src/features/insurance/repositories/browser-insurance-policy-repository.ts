import { z } from "zod";

import { BrowserCustomerRepository } from "@/features/customer/repositories/browser-customer-repository";
import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";

import {
  StoredInsurancePolicyWireSchema,
  parseInsuranceCustomerId,
  parseInsurancePolicyId,
  parseInsurancePolicyInput,
  parseInsurancePolicyWire,
  toInsurancePolicyWireInput,
} from "../schemas/insurance-policy-schema";
import type {
  InsurancePolicy,
  InsurancePolicyInput,
  InsurancePolicyWire,
} from "../types/insurance-policy";
import { InsuranceRepositoryError } from "../types/insurance-error";
import type { InsurancePolicyRepository } from "./insurance-policy-repository";

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

type StoredInsurancePolicyWire = z.infer<typeof StoredInsurancePolicyWireSchema>;

export interface BrowserInsurancePolicyRepositoryOptions {
  readonly storage?: StoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly customerRepository?: Pick<CustomerRepository, "list">;
}

export const BROWSER_INSURANCE_POLICY_STORAGE_KEY =
  "bodam.preview.synthetic-insurance-policies.v1";

const storedPoliciesSchema = z.array(StoredInsurancePolicyWireSchema);

const defaultStorage = (): StoragePort => {
  if (typeof window === "undefined") {
    throw new InsuranceRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const defaultCreateId = (): string => globalThis.crypto.randomUUID();
const defaultNow = (): string => new Date().toISOString();

const notFoundError = (): InsuranceRepositoryError =>
  new InsuranceRepositoryError("보험계약을 찾을 수 없습니다.", "not_found");

export class BrowserInsurancePolicyRepository
implements InsurancePolicyRepository {
  private readonly storage: StoragePort;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly customerRepository: Pick<CustomerRepository, "list">;

  constructor(options: BrowserInsurancePolicyRepositoryOptions = {}) {
    this.storage = options.storage ?? defaultStorage();
    this.now = options.now ?? defaultNow;
    this.createId = options.createId ?? defaultCreateId;
    this.customerRepository = options.customerRepository
      ?? new BrowserCustomerRepository({ storage: this.storage });
  }

  async list(customerId: string): Promise<InsurancePolicy[]> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    await this.ensureActiveCustomer(parsedCustomerId);
    return this.load()
      .filter(
        (policy) =>
          policy.customerId === parsedCustomerId && policy.deletedAt === null,
      )
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
      )
      .map((policy) => this.toDomain(policy));
  }

  async create(
    customerId: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedCustomerId = parseInsuranceCustomerId(customerId);
    const parsedInput = parseInsurancePolicyInput(input);
    await this.ensureActiveCustomer(parsedCustomerId);
    const policies = this.load();
    const id = this.createId();
    if (policies.some((policy) => policy.id === id)) {
      throw new InsuranceRepositoryError("보험계약 식별자를 생성하지 못했습니다.");
    }

    const timestamp = this.now();
    const stored = this.parseStored({
      id,
      customerId: parsedCustomerId,
      ...toInsurancePolicyWireInput(parsedInput),
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.save([...policies, stored]);
    return this.toDomain(stored);
  }

  async update(
    id: string,
    input: InsurancePolicyInput,
  ): Promise<InsurancePolicy> {
    const parsedId = parseInsurancePolicyId(id);
    const parsedInput = parseInsurancePolicyInput(input);
    const policies = this.load();
    const index = policies.findIndex(
      (policy) => policy.id === parsedId && policy.deletedAt === null,
    );
    const existing = policies[index];
    if (index < 0 || existing === undefined) throw notFoundError();
    await this.ensureActiveCustomer(existing.customerId);

    const updated = this.parseStored({
      ...existing,
      ...toInsurancePolicyWireInput(parsedInput),
      updatedAt: this.now(),
    });
    policies[index] = updated;
    this.save(policies);
    return this.toDomain(updated);
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseInsurancePolicyId(id);
    const policies = this.load();
    const index = policies.findIndex(
      (policy) => policy.id === parsedId && policy.deletedAt === null,
    );
    const existing = policies[index];
    if (index < 0 || existing === undefined) throw notFoundError();
    await this.ensureActiveCustomer(existing.customerId);

    const timestamp = this.now();
    policies[index] = this.parseStored({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.save(policies);
  }

  private load(): StoredInsurancePolicyWire[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_INSURANCE_POLICY_STORAGE_KEY);
    } catch {
      throw new InsuranceRepositoryError(
        "미리보기 보험계약 저장소를 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }
    if (serialized === null) return [];

    try {
      const result = storedPoliciesSchema.safeParse(JSON.parse(serialized));
      if (result.success) return result.data;
    } catch {
      // Corrupt storage is reported without exposing its contents.
    }
    throw new InsuranceRepositoryError(
      "저장된 미리보기 보험계약 데이터를 읽을 수 없습니다.",
      "storage_corrupt",
    );
  }

  private save(policies: readonly StoredInsurancePolicyWire[]): void {
    try {
      this.storage.setItem(
        BROWSER_INSURANCE_POLICY_STORAGE_KEY,
        JSON.stringify(policies),
      );
    } catch {
      throw new InsuranceRepositoryError(
        "미리보기 보험계약 저장소에 저장할 수 없습니다.",
        "storage_unavailable",
      );
    }
  }

  private async ensureActiveCustomer(customerId: string): Promise<void> {
    let customers: Awaited<ReturnType<CustomerRepository["list"]>>;
    try {
      customers = await this.customerRepository.list({});
    } catch {
      throw new InsuranceRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
    if (!customers.some((customer) => customer.id === customerId)) {
      throw new InsuranceRepositoryError(
        "활성 고객을 찾을 수 없습니다.",
        "customer_not_found",
      );
    }
  }

  private parseStored(value: unknown): StoredInsurancePolicyWire {
    const result = StoredInsurancePolicyWireSchema.safeParse(value);
    if (!result.success) {
      throw new InsuranceRepositoryError("보험계약 데이터를 저장할 수 없습니다.");
    }
    return result.data;
  }

  private toDomain(policy: StoredInsurancePolicyWire): InsurancePolicy {
    const wire: InsurancePolicyWire = {
      id: policy.id,
      customerId: policy.customerId,
      insurer: policy.insurer,
      productName: policy.productName,
      joinedOn: policy.joinedOn,
      coverageTerm: policy.coverageTerm,
      paymentTerm: policy.paymentTerm,
      monthlyPremiumWon: policy.monthlyPremiumWon,
      disclosurePlan: policy.disclosurePlan,
      maturesOn: policy.maturesOn,
      renewable: policy.renewable,
      status: policy.status,
      isIncluded: policy.isIncluded,
      createdAt: policy.createdAt,
      updatedAt: policy.updatedAt,
    };
    return parseInsurancePolicyWire(wire);
  }
}
