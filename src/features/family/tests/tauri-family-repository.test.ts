import { describe, expect, it } from "vitest";

import {
  TauriFamilyRepository,
  type FamilyInvoke,
} from "../repositories/tauri-family-repository";
import type { Family, FamilyMembership } from "../types/family";
import {
  CUSTOMER_IDS,
  FAMILY_IDS,
  MEMBERSHIP_IDS,
  family,
  membership,
} from "./family-test-data";

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

function invocationHarness(overrides: Record<string, unknown> = {}) {
  const calls: Invocation[] = [];
  const responses: Record<string, unknown> = {
    list_families: [family(FAMILY_IDS[0])],
    create_family: family(FAMILY_IDS[0]),
    update_family: { ...family(FAMILY_IDS[0]), name: "합성 수정" },
    delete_family: { id: FAMILY_IDS[0] },
    list_family_memberships: [
      membership(MEMBERSHIP_IDS[0], FAMILY_IDS[0], CUSTOMER_IDS[0]),
    ],
    add_family_membership: membership(
      MEMBERSHIP_IDS[0],
      FAMILY_IDS[0],
      CUSTOMER_IDS[0],
    ),
    update_family_membership: membership(
      MEMBERSHIP_IDS[0],
      FAMILY_IDS[0],
      CUSTOMER_IDS[0],
      "합성 관계",
    ),
    delete_family_membership: { id: MEMBERSHIP_IDS[0] },
    ...overrides,
  };
  const invoke: FamilyInvoke = <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => {
    calls.push({ command, args });
    return Promise.resolve(responses[command] as T);
  };
  return { calls, repository: new TauriFamilyRepository(invoke) };
}

describe("TauriFamilyRepository command contract", () => {
  it("uses exact family commands, normalized payloads, and strict responses", async () => {
    const { calls, repository } = invocationHarness();

    await expect(repository.list("   ")).resolves.toHaveLength(1);
    await repository.create({ name: "  합성 가족  " });
    await repository.update(FAMILY_IDS[0], { name: "  합성 수정  " });
    await repository.remove(FAMILY_IDS[0]);
    await repository.listMemberships(FAMILY_IDS[0]);
    await repository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: "   ",
    });
    await repository.updateMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0], {
      relationshipName: "  합성 관계  ",
    });
    await repository.removeMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0]);

    expect(calls).toEqual([
      { command: "list_families", args: { search: null } },
      { command: "create_family", args: { input: { name: "합성 가족" } } },
      {
        command: "update_family",
        args: { id: FAMILY_IDS[0], input: { name: "합성 수정" } },
      },
      { command: "delete_family", args: { id: FAMILY_IDS[0] } },
      {
        command: "list_family_memberships",
        args: { familyId: FAMILY_IDS[0] },
      },
      {
        command: "add_family_membership",
        args: {
          familyId: FAMILY_IDS[0],
          input: { customerId: CUSTOMER_IDS[0], relationshipName: null },
        },
      },
      {
        command: "update_family_membership",
        args: {
          familyId: FAMILY_IDS[0],
          id: MEMBERSHIP_IDS[0],
          input: { relationshipName: "합성 관계" },
        },
      },
      {
        command: "delete_family_membership",
        args: { familyId: FAMILY_IDS[0], id: MEMBERSHIP_IDS[0] },
      },
    ]);
  });

  it("rejects malformed native output and mismatched delete acknowledgements", async () => {
    const malformedFamily = {
      ...family(FAMILY_IDS[0]),
      rogue: "synthetic-private-marker",
    } as Family;
    const { repository } = invocationHarness({
      list_families: [malformedFamily],
      delete_family_membership: { id: MEMBERSHIP_IDS[1] },
    });

    await expect(repository.list("")).rejects.toMatchObject({ code: "unexpected" });
    await expect(repository.removeMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0]))
      .rejects.toMatchObject({
        code: "unexpected",
        message: "가족 구성원 삭제 응답을 확인할 수 없습니다.",
      });
  });

  it.each([
    ["FAMILY_NOT_FOUND", "not_found"],
    ["FAMILY_MEMBERSHIP_NOT_FOUND", "membership_not_found"],
    ["FAMILY_MEMBERSHIP_CONFLICT", "conflict"],
    ["CUSTOMER_NOT_FOUND", "customer_not_found"],
    ["VALIDATION_ERROR", "unexpected"],
  ])("maps native %s to safe %s errors", async (nativeCode, expectedCode) => {
    const invoke: FamilyInvoke = () => Promise.reject({
      code: nativeCode,
      message: "synthetic private native detail",
    });
    const repository = new TauriFamilyRepository(invoke);

    await expect(repository.list("")).rejects.toMatchObject({ code: expectedCode });
    await expect(repository.list("")).rejects.not.toThrow("synthetic private native detail");
  });

  it("keeps membership response fields camelCase and exact", async () => {
    const rogue = {
      ...membership(MEMBERSHIP_IDS[0], FAMILY_IDS[0], CUSTOMER_IDS[0]),
      relationship_name: "synthetic rogue",
    } as FamilyMembership;
    const { repository } = invocationHarness({ list_family_memberships: [rogue] });
    await expect(repository.listMemberships(FAMILY_IDS[0]))
      .rejects.toMatchObject({ code: "unexpected" });
  });
});
