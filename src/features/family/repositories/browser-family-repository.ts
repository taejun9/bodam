import { BrowserCustomerRepository } from "@/features/customer/repositories/browser-customer-repository";
import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";

import {
  parseFamilyId,
  parseFamilyInput,
  parseFamilyMembershipInput,
  parseFamilyMembershipUpdateInput,
  parseFamilySearch,
} from "../schemas/family-schema";
import type {
  Family,
  FamilyInput,
  FamilyMembership,
  FamilyMembershipInput,
  FamilyMembershipUpdateInput,
} from "../types/family";
import { FamilyRepositoryError } from "../types/family-error";
import {
  familyFromStored,
  membershipFromStored,
  parseStoredFamily,
  parseStoredMembership,
} from "./browser-family-mapping";
import {
  BrowserFamilyStorage,
  type FamilyStoragePort,
  type StoredFamily,
} from "./browser-family-storage";
import type { FamilyRepository } from "./family-repository";

export interface BrowserFamilyRepositoryOptions {
  readonly storage?: FamilyStoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
  readonly customerRepository?: Pick<CustomerRepository, "list">;
}

const defaultStorage = (): FamilyStoragePort => {
  if (typeof window === "undefined") {
    throw new FamilyRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const familyNotFound = (): FamilyRepositoryError =>
  new FamilyRepositoryError("가족을 찾을 수 없습니다.", "not_found");
const membershipNotFound = (): FamilyRepositoryError =>
  new FamilyRepositoryError("가족 구성원 관계를 찾을 수 없습니다.", "membership_not_found");
const customerNotFound = (): FamilyRepositoryError =>
  new FamilyRepositoryError("활성 고객을 찾을 수 없습니다.", "customer_not_found");
const membershipConflict = (): FamilyRepositoryError =>
  new FamilyRepositoryError("이미 이 가족에 등록된 고객입니다.", "conflict");

function sqliteNoCase(value: string): string {
  return value.replace(/[A-Z]/g, (character) => character.toLowerCase());
}

export class BrowserFamilyRepository implements FamilyRepository {
  private readonly store: BrowserFamilyStorage;
  private readonly now: () => string;
  private readonly createId: () => string;
  private readonly customerRepository: Pick<CustomerRepository, "list">;

  constructor(options: BrowserFamilyRepositoryOptions = {}) {
    const storage = options.storage ?? defaultStorage();
    this.store = new BrowserFamilyStorage(storage);
    this.now = options.now ?? (() => new Date().toISOString());
    this.createId = options.createId ?? (() => globalThis.crypto.randomUUID());
    this.customerRepository = options.customerRepository
      ?? new BrowserCustomerRepository({ storage });
  }

  async list(search: string): Promise<Family[]> {
    const needle = sqliteNoCase(parseFamilySearch(search));
    return this.activeFamilies()
      .filter((family) => sqliteNoCase(family.name).includes(needle))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "ko-KR") || left.id.localeCompare(right.id),
      )
      .map(familyFromStored);
  }

  async create(input: FamilyInput): Promise<Family> {
    const parsedInput = parseFamilyInput(input);
    const families = this.store.loadFamilies();
    const id = this.createId();
    if (families.some((family) => family.id === id)) {
      throw new FamilyRepositoryError("가족 식별자를 생성하지 못했습니다.");
    }
    const timestamp = this.now();
    const stored = parseStoredFamily({
      id,
      ...parsedInput,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.saveFamilies([...families, stored]);
    return familyFromStored(stored);
  }

  async update(id: string, input: FamilyInput): Promise<Family> {
    const parsedId = parseFamilyId(id);
    const parsedInput = parseFamilyInput(input);
    const families = this.store.loadFamilies();
    const index = families.findIndex(
      (family) => family.id === parsedId && family.deletedAt === null,
    );
    const existing = families[index];
    if (index < 0 || existing === undefined) throw familyNotFound();
    const updated = parseStoredFamily({
      ...existing,
      ...parsedInput,
      updatedAt: this.now(),
    });
    families[index] = updated;
    this.store.saveFamilies(families);
    return familyFromStored(updated);
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseFamilyId(id);
    const families = this.store.loadFamilies();
    const index = families.findIndex(
      (family) => family.id === parsedId && family.deletedAt === null,
    );
    const existing = families[index];
    if (index < 0 || existing === undefined) throw familyNotFound();
    const timestamp = this.now();
    families[index] = parseStoredFamily({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.saveFamilies(families);
  }

  async listMemberships(familyId: string): Promise<FamilyMembership[]> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    this.ensureActiveFamily(parsedFamilyId);
    const customers = await this.activeCustomers();
    return this.store.loadMemberships()
      .filter(
        (membership) =>
          membership.familyId === parsedFamilyId &&
          membership.deletedAt === null &&
          customers.has(membership.customerId),
      )
      .sort((left, right) => {
        const byName = (customers.get(left.customerId) ?? "").localeCompare(
          customers.get(right.customerId) ?? "",
          "ko-KR",
        );
        return byName || left.customerId.localeCompare(right.customerId) ||
          left.id.localeCompare(right.id);
      })
      .map(membershipFromStored);
  }

  async addMembership(
    familyId: string,
    input: FamilyMembershipInput,
  ): Promise<FamilyMembership> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedInput = parseFamilyMembershipInput(input);
    this.ensureActiveFamily(parsedFamilyId);
    await this.ensureActiveCustomer(parsedInput.customerId);
    const memberships = this.store.loadMemberships();
    const index = memberships.findIndex(
      (item) => item.familyId === parsedFamilyId && item.customerId === parsedInput.customerId,
    );
    const existing = memberships[index];
    if (existing?.deletedAt === null) throw membershipConflict();

    const timestamp = this.now();
    if (existing !== undefined) {
      const reactivated = parseStoredMembership({
        ...existing,
        relationshipName: parsedInput.relationshipName,
        updatedAt: timestamp,
        deletedAt: null,
      });
      memberships[index] = reactivated;
      this.store.saveMemberships(memberships);
      return membershipFromStored(reactivated);
    }

    const id = this.createId();
    if (memberships.some((membership) => membership.id === id)) {
      throw new FamilyRepositoryError("가족 구성원 관계 식별자를 생성하지 못했습니다.");
    }
    const created = parseStoredMembership({
      id,
      familyId: parsedFamilyId,
      ...parsedInput,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    });
    this.store.saveMemberships([...memberships, created]);
    return membershipFromStored(created);
  }

  async updateMembership(
    familyId: string,
    id: string,
    input: FamilyMembershipUpdateInput,
  ): Promise<FamilyMembership> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedId = parseFamilyId(id);
    const parsedInput = parseFamilyMembershipUpdateInput(input);
    this.ensureActiveFamily(parsedFamilyId);
    const customers = await this.activeCustomers();
    const memberships = this.store.loadMemberships();
    const index = memberships.findIndex(
      (item) =>
        item.id === parsedId && item.familyId === parsedFamilyId &&
        item.deletedAt === null && customers.has(item.customerId),
    );
    const existing = memberships[index];
    if (index < 0 || existing === undefined) throw membershipNotFound();
    const updated = parseStoredMembership({
      ...existing,
      ...parsedInput,
      updatedAt: this.now(),
    });
    memberships[index] = updated;
    this.store.saveMemberships(memberships);
    return membershipFromStored(updated);
  }

  async removeMembership(familyId: string, id: string): Promise<void> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const parsedId = parseFamilyId(id);
    this.ensureActiveFamily(parsedFamilyId);
    const customers = await this.activeCustomers();
    const memberships = this.store.loadMemberships();
    const index = memberships.findIndex(
      (item) =>
        item.id === parsedId && item.familyId === parsedFamilyId &&
        item.deletedAt === null && customers.has(item.customerId),
    );
    const existing = memberships[index];
    if (index < 0 || existing === undefined) throw membershipNotFound();
    const timestamp = this.now();
    memberships[index] = parseStoredMembership({
      ...existing,
      updatedAt: timestamp,
      deletedAt: timestamp,
    });
    this.store.saveMemberships(memberships);
  }

  private activeFamilies(): StoredFamily[] {
    return this.store.loadFamilies().filter((family) => family.deletedAt === null);
  }

  private ensureActiveFamily(id: string): void {
    if (!this.activeFamilies().some((family) => family.id === id)) throw familyNotFound();
  }

  private async activeCustomers(): Promise<Map<string, string>> {
    try {
      return new Map(
        (await this.customerRepository.list({}))
          .map((customer) => [customer.id, customer.name]),
      );
    } catch {
      throw new FamilyRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
  }

  private async ensureActiveCustomer(id: string): Promise<void> {
    if (!(await this.activeCustomers()).has(id)) throw customerNotFound();
  }
}
