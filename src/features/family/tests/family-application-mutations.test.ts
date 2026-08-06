import { describe, expect, it, vi } from "vitest";

import { FamilyApplication } from "../application/family-application";
import type { FamilyRepository } from "../repositories/family-repository";
import { FamilyRepositoryError } from "../types/family-error";
import {
  CUSTOMER_IDS,
  FAMILY_IDS,
  MEMBERSHIP_IDS,
  family,
  membership,
} from "./family-test-data";

function repositorySpies(): FamilyRepository {
  return {
    list: vi.fn().mockResolvedValue([]),
    create: vi.fn((input) => Promise.resolve({ ...family(FAMILY_IDS[0]), ...input })),
    update: vi.fn((id, input) => Promise.resolve({ ...family(id), ...input })),
    remove: vi.fn().mockResolvedValue(undefined),
    listMemberships: vi.fn().mockResolvedValue([]),
    addMembership: vi.fn((familyId, input) => Promise.resolve({
      ...membership(MEMBERSHIP_IDS[0], familyId, input.customerId),
      ...input,
    })),
    updateMembership: vi.fn((familyId, id, input) => Promise.resolve({
      ...membership(id, familyId, CUSTOMER_IDS[0]),
      ...input,
    })),
    removeMembership: vi.fn().mockResolvedValue(undefined),
  };
}

const customerReader = { list: () => Promise.resolve([]) };
const insuranceReader = {
  list: () => Promise.resolve([]),
  total: () => 0n,
};

describe("FamilyApplication mutations", () => {
  it("normalizes family and relationship inputs before repository writes", async () => {
    const repository = repositorySpies();
    const application = new FamilyApplication(repository, customerReader, insuranceReader);

    await expect(application.create({ name: "  합성 가족  " }))
      .resolves.toMatchObject({ name: "합성 가족" });
    await application.update(FAMILY_IDS[0], { name: "  합성 수정  " });
    await application.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: "   ",
    });
    await application.updateMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0], {
      relationshipName: "  합성 관계  ",
    });

    expect(repository.create).toHaveBeenCalledWith({ name: "합성 가족" });
    expect(repository.update).toHaveBeenCalledWith(FAMILY_IDS[0], { name: "합성 수정" });
    expect(repository.addMembership).toHaveBeenCalledWith(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: null,
    });
    expect(repository.updateMembership).toHaveBeenCalledWith(
      FAMILY_IDS[0],
      MEMBERSHIP_IDS[0],
      { relationshipName: "합성 관계" },
    );
  });

  it("validates identifiers before delete operations", async () => {
    const repository = repositorySpies();
    const application = new FamilyApplication(repository, customerReader, insuranceReader);

    await application.remove(FAMILY_IDS[0]);
    await application.removeMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0]);
    expect(repository.remove).toHaveBeenCalledWith(FAMILY_IDS[0]);
    expect(repository.removeMembership).toHaveBeenCalledWith(
      FAMILY_IDS[0],
      MEMBERSHIP_IDS[0],
    );

    await expect(application.remove("not-a-uuid")).rejects.toMatchObject({
      code: "validation",
    });
    expect(repository.remove).toHaveBeenCalledTimes(1);
  });

  it("rejects malformed repository outputs without exposing their values", async () => {
    const repository = repositorySpies();
    vi.mocked(repository.create).mockResolvedValue({
      ...family(FAMILY_IDS[0]),
      name: "",
    });
    const application = new FamilyApplication(repository, customerReader, insuranceReader);

    await expect(application.create({ name: "합성 가족" })).rejects.toEqual(
      new FamilyRepositoryError("가족 데이터 응답을 확인할 수 없습니다."),
    );
  });
});
