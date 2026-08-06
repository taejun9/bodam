import { describe, expect, it, vi } from "vitest";

import { calculateIncludedMonthlyPremiumTotal } from "@/features/insurance/services/monthly-premium-total";

import {
  FamilyApplication,
  type FamilyCustomerReader,
  type FamilyInsuranceReader,
} from "../application/family-application";
import type { FamilyRepository } from "../repositories/family-repository";
import type {
  Family,
  FamilyMembership,
} from "../types/family";
import { FamilyRepositoryError } from "../types/family-error";
import {
  CUSTOMER_IDS,
  FAMILY_IDS,
  MEMBERSHIP_IDS,
  POLICY_IDS,
  customer,
  family,
  membership,
  policy,
} from "./family-test-data";

class MemoryFamilyRepository implements FamilyRepository {
  readonly searches: string[] = [];

  constructor(
    readonly families: Family[],
    readonly memberships: FamilyMembership[],
  ) {}

  list(search: string): Promise<Family[]> {
    this.searches.push(search);
    return Promise.resolve(
      this.families.filter((item) => item.name.includes(search)),
    );
  }

  listMemberships(familyId: string): Promise<FamilyMembership[]> {
    return Promise.resolve(
      this.memberships.filter((item) => item.familyId === familyId),
    );
  }

  create(): Promise<Family> {
    return Promise.reject(new Error("unused"));
  }

  update(): Promise<Family> {
    return Promise.reject(new Error("unused"));
  }

  remove(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }

  addMembership(): Promise<FamilyMembership> {
    return Promise.reject(new Error("unused"));
  }

  updateMembership(): Promise<FamilyMembership> {
    return Promise.reject(new Error("unused"));
  }

  removeMembership(): Promise<void> {
    return Promise.reject(new Error("unused"));
  }
}

function readers() {
  const customerReader: FamilyCustomerReader = {
    list: vi.fn().mockResolvedValue([
      customer(CUSTOMER_IDS[0], "합성 나 고객"),
      customer(CUSTOMER_IDS[2], "합성 가 고객"),
    ]),
  };
  const policies = new Map<string, ReturnType<typeof policy>[]>([
    [CUSTOMER_IDS[0], [
      policy(POLICY_IDS[0], CUSTOMER_IDS[0], 9_223_372_036_854_775_807n),
      policy(POLICY_IDS[1], CUSTOMER_IDS[0], 99n, false),
    ]],
    [CUSTOMER_IDS[2], [policy(POLICY_IDS[2], CUSTOMER_IDS[2], 10n)]],
  ]);
  const insuranceReader: FamilyInsuranceReader = {
    list: vi.fn((customerId: string) => Promise.resolve(policies.get(customerId) ?? [])),
    total: vi.fn(calculateIncludedMonthlyPremiumTotal),
  };
  return { customerReader, insuranceReader };
}

const families = [
  family(FAMILY_IDS[0], "합성 같은 이름"),
  family(FAMILY_IDS[1], "합성 같은 이름"),
];
const memberships = [
  membership(MEMBERSHIP_IDS[0], FAMILY_IDS[0], CUSTOMER_IDS[0], "합성 관계 A"),
  membership(MEMBERSHIP_IDS[1], FAMILY_IDS[0], CUSTOMER_IDS[1], "숨김 고객"),
  membership(MEMBERSHIP_IDS[2], FAMILY_IDS[1], CUSTOMER_IDS[0], "합성 관계 B"),
  membership(MEMBERSHIP_IDS[3], FAMILY_IDS[1], CUSTOMER_IDS[2], null),
];

describe("FamilyApplication read models", () => {
  it("intersects active customers and caches each customer policy load across families", async () => {
    const repository = new MemoryFamilyRepository(families, memberships);
    const { customerReader, insuranceReader } = readers();
    const application = new FamilyApplication(repository, customerReader, insuranceReader);

    const summaries = await application.list("  합성  ");

    expect(repository.searches).toEqual(["합성"]);
    expect(summaries).toEqual([
      {
        family: families[0],
        memberCount: 1,
        totalMonthlyPremiumWon: 9_223_372_036_854_775_807n,
      },
      {
        family: families[1],
        memberCount: 2,
        totalMonthlyPremiumWon: 9_223_372_036_854_775_817n,
      },
    ]);
    expect(customerReader.list).toHaveBeenCalledTimes(1);
    expect(insuranceReader.list).toHaveBeenCalledTimes(2);
    expect(insuranceReader.list).not.toHaveBeenCalledWith(CUSTOMER_IDS[1]);
  });

  it("builds stable member detail with included policy counts and bigint total", async () => {
    const { customerReader, insuranceReader } = readers();
    const application = new FamilyApplication(
      new MemoryFamilyRepository(families, memberships),
      customerReader,
      insuranceReader,
    );

    const detail = await application.detail(FAMILY_IDS[1]);

    expect(detail.family.id).toBe(FAMILY_IDS[1]);
    expect(detail.members.map(({ customerId }) => customerId)).toEqual([
      CUSTOMER_IDS[2],
      CUSTOMER_IDS[0],
    ]);
    expect(detail.members[1]).toMatchObject({
      relationshipName: "합성 관계 B",
      totalMonthlyPremiumWon: 9_223_372_036_854_775_807n,
      includedPolicyCount: 1,
    });
    expect(detail.totalMonthlyPremiumWon).toBe(9_223_372_036_854_775_817n);
  });

  it("lists only active customers without an active membership", async () => {
    const { customerReader, insuranceReader } = readers();
    const application = new FamilyApplication(
      new MemoryFamilyRepository(families, memberships),
      customerReader,
      insuranceReader,
    );

    await expect(application.availableCustomers(FAMILY_IDS[0])).resolves.toEqual([
      { id: CUSTOMER_IDS[2], name: "합성 가 고객" },
    ]);
  });

  it("returns a safe not-found error for an inactive family", async () => {
    const { customerReader, insuranceReader } = readers();
    const application = new FamilyApplication(
      new MemoryFamilyRepository(families, memberships),
      customerReader,
      insuranceReader,
    );

    await expect(application.detail("40000000-0000-4000-8000-000000000099"))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(application.detail("not-a-uuid")).rejects.toMatchObject({
      code: "validation",
    });
  });

  it("redacts failures from injected feature readers", async () => {
    const customerReader: FamilyCustomerReader = {
      list: () => Promise.reject(
        new FamilyRepositoryError("synthetic customer detail"),
      ),
    };
    const insuranceReader: FamilyInsuranceReader = {
      list: () => Promise.reject(new Error("synthetic policy detail")),
      total: () => 0n,
    };
    const application = new FamilyApplication(
      new MemoryFamilyRepository(families, memberships),
      customerReader,
      insuranceReader,
    );

    await expect(application.list()).rejects.toEqual(
      new FamilyRepositoryError("활성 고객을 확인할 수 없습니다."),
    );
  });
});
