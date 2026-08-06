import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

import type { FamilyRepository } from "../repositories/family-repository";
import {
  parseFamily,
  parseFamilyCustomerOptionList,
  parseFamilyDetail,
  parseFamilyId,
  parseFamilyInput,
  parseFamilyList,
  parseFamilyMembership,
  parseFamilyMembershipInput,
  parseFamilyMembershipList,
  parseFamilyMembershipUpdateInput,
  parseFamilySearch,
  parseFamilySummaryList,
} from "../schemas/family-schema";
import { sumFamilyMonthlyPremium } from "../services/family-premium";
import type {
  Family,
  FamilyCustomerOption,
  FamilyDetail,
  FamilyInput,
  FamilyMemberView,
  FamilyMembership,
  FamilyMembershipInput,
  FamilyMembershipUpdateInput,
  FamilySummary,
} from "../types/family";
import { FamilyRepositoryError } from "../types/family-error";

export interface FamilyCustomerReader {
  list(search?: string): Promise<readonly Customer[]>;
}

export interface FamilyInsuranceReader {
  list(customerId: string): Promise<readonly InsurancePolicy[]>;
  total(policies: readonly InsurancePolicy[]): bigint;
}

interface MemberPremium {
  readonly totalMonthlyPremiumWon: bigint;
  readonly includedPolicyCount: number;
}

type PremiumLoader = (customerId: string) => Promise<MemberPremium>;

export class FamilyApplication {
  constructor(
    private readonly repository: FamilyRepository,
    private readonly customers: FamilyCustomerReader,
    private readonly insurance: FamilyInsuranceReader,
  ) {}

  async list(search = ""): Promise<FamilySummary[]> {
    const parsedSearch = parseFamilySearch(search);
    const [families, customerOptions] = await Promise.all([
      this.repository.list(parsedSearch).then(parseFamilyList),
      this.activeCustomers(),
    ]);
    const customerMap = new Map(customerOptions.map((customer) => [customer.id, customer]));
    const membershipLists = await Promise.all(
      families.map((family) =>
        this.repository.listMemberships(family.id).then(parseFamilyMembershipList)
      ),
    );
    const loadPremium = this.premiumLoader();
    const summaries = await Promise.all(
      families.map(async (family, index): Promise<FamilySummary> => {
        const memberships = (membershipLists[index] ?? []).filter((membership) =>
          customerMap.has(membership.customerId)
        );
        const premiums = await Promise.all(
          memberships.map((membership) => loadPremium(membership.customerId)),
        );
        return {
          family,
          memberCount: memberships.length,
          totalMonthlyPremiumWon: sumFamilyMonthlyPremium(
            premiums.map((premium) => premium.totalMonthlyPremiumWon),
          ),
        };
      }),
    );
    return parseFamilySummaryList(summaries);
  }

  async detail(familyId: string): Promise<FamilyDetail> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    const family = await this.findFamily(parsedFamilyId);
    const [memberships, customerOptions] = await Promise.all([
      this.repository.listMemberships(parsedFamilyId).then(parseFamilyMembershipList),
      this.activeCustomers(),
    ]);
    const customerMap = new Map(customerOptions.map((customer) => [customer.id, customer]));
    const loadPremium = this.premiumLoader();
    const members = (await Promise.all(
      memberships.flatMap((membership) => {
        const customer = customerMap.get(membership.customerId);
        if (customer === undefined) return [];
        return [this.memberView(membership, customer, loadPremium)];
      }),
    )).sort((left, right) =>
      left.customerName.localeCompare(right.customerName, "ko-KR") ||
      left.customerId.localeCompare(right.customerId) ||
      left.membershipId.localeCompare(right.membershipId)
    );
    return parseFamilyDetail({
      family,
      members,
      totalMonthlyPremiumWon: sumFamilyMonthlyPremium(
        members.map((member) => member.totalMonthlyPremiumWon),
      ),
    });
  }

  async availableCustomers(familyId: string): Promise<FamilyCustomerOption[]> {
    const parsedFamilyId = parseFamilyId(familyId, "familyId");
    await this.findFamily(parsedFamilyId);
    const [memberships, customers] = await Promise.all([
      this.repository.listMemberships(parsedFamilyId).then(parseFamilyMembershipList),
      this.activeCustomers(),
    ]);
    const memberIds = new Set(memberships.map((membership) => membership.customerId));
    return customers
      .filter((customer) => !memberIds.has(customer.id))
      .sort((left, right) =>
        left.name.localeCompare(right.name, "ko-KR") || left.id.localeCompare(right.id),
      );
  }

  async create(input: FamilyInput): Promise<Family> {
    return parseFamily(await this.repository.create(parseFamilyInput(input)));
  }

  async update(id: string, input: FamilyInput): Promise<Family> {
    return parseFamily(
      await this.repository.update(parseFamilyId(id), parseFamilyInput(input)),
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseFamilyId(id));
  }

  async addMembership(
    familyId: string,
    input: FamilyMembershipInput,
  ): Promise<FamilyMembership> {
    return parseFamilyMembership(
      await this.repository.addMembership(
        parseFamilyId(familyId, "familyId"),
        parseFamilyMembershipInput(input),
      ),
    );
  }

  async updateMembership(
    familyId: string,
    id: string,
    input: FamilyMembershipUpdateInput,
  ): Promise<FamilyMembership> {
    return parseFamilyMembership(
      await this.repository.updateMembership(
        parseFamilyId(familyId, "familyId"),
        parseFamilyId(id),
        parseFamilyMembershipUpdateInput(input),
      ),
    );
  }

  async removeMembership(familyId: string, id: string): Promise<void> {
    await this.repository.removeMembership(
      parseFamilyId(familyId, "familyId"),
      parseFamilyId(id),
    );
  }

  private async findFamily(id: string): Promise<Family> {
    const family = parseFamilyList(await this.repository.list(""))
      .find((candidate) => candidate.id === id);
    if (family === undefined) {
      throw new FamilyRepositoryError("가족을 찾을 수 없습니다.", "not_found");
    }
    return family;
  }

  private async activeCustomers(): Promise<FamilyCustomerOption[]> {
    let customers: readonly Customer[];
    try {
      customers = await this.customers.list();
    } catch {
      throw new FamilyRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
    return parseFamilyCustomerOptionList(
      customers.map(({ id, name }) => ({ id, name })),
    );
  }

  private premiumLoader(): PremiumLoader {
    const cache = new Map<string, Promise<MemberPremium>>();
    return (customerId) => {
      const cached = cache.get(customerId);
      if (cached !== undefined) return cached;
      const pending = this.memberPremium(customerId);
      cache.set(customerId, pending);
      return pending;
    };
  }

  private async memberPremium(customerId: string): Promise<MemberPremium> {
    try {
      const policies = await this.insurance.list(customerId);
      return {
        totalMonthlyPremiumWon: this.insurance.total(policies),
        includedPolicyCount: policies.filter((policy) => policy.isIncluded).length,
      };
    } catch {
      throw new FamilyRepositoryError("가족 보험료를 확인할 수 없습니다.");
    }
  }

  private async memberView(
    membership: FamilyMembership,
    customer: FamilyCustomerOption,
    loadPremium: PremiumLoader,
  ): Promise<FamilyMemberView> {
    const premium = await loadPremium(customer.id);
    return {
      membershipId: membership.id,
      customerId: customer.id,
      customerName: customer.name,
      relationshipName: membership.relationshipName,
      ...premium,
    };
  }
}
