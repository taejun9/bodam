import { describe, expect, it } from "vitest";

import {
  MAX_FAMILY_TEXT_CHARS,
  parseFamily,
  parseFamilyCustomerOptionList,
  parseFamilyDetail,
  parseFamilyId,
  parseFamilyInput,
  parseFamilyMembershipInput,
  parseFamilyMembershipUpdateInput,
  parseFamilySearch,
} from "../schemas/family-schema";
import { sumFamilyMonthlyPremium } from "../services/family-premium";
import {
  FamilyRepositoryError,
  FamilyValidationError,
  familySafeMessage,
} from "../types/family-error";
import {
  CUSTOMER_IDS,
  FAMILY_IDS,
  MEMBERSHIP_IDS,
  family,
} from "./family-test-data";

describe("family schemas", () => {
  it("normalizes bounded Unicode family names and rejects loose input", () => {
    expect(parseFamilyInput({ name: "  합성 가족  " })).toEqual({ name: "합성 가족" });
    expect(parseFamilyInput({ name: "가".repeat(MAX_FAMILY_TEXT_CHARS) }).name)
      .toHaveLength(MAX_FAMILY_TEXT_CHARS);

    for (const input of [
      { name: " " },
      { name: "나".repeat(MAX_FAMILY_TEXT_CHARS + 1) },
      { name: "합성 가족", extra: true },
      {},
    ]) {
      expect(() => parseFamilyInput(input)).toThrow(FamilyValidationError);
    }
  });

  it("normalizes optional relationship labels and keeps update payloads strict", () => {
    expect(parseFamilyMembershipInput({
      customerId: CUSTOMER_IDS[0],
      relationshipName: "  합성 관계  ",
    })).toEqual({
      customerId: CUSTOMER_IDS[0],
      relationshipName: "합성 관계",
    });
    expect(parseFamilyMembershipInput({
      customerId: CUSTOMER_IDS[0],
      relationshipName: "   ",
    }).relationshipName).toBeNull();
    expect(parseFamilyMembershipUpdateInput({ relationshipName: null }))
      .toEqual({ relationshipName: null });

    expect(() => parseFamilyMembershipInput({
      customerId: CUSTOMER_IDS[0],
    })).toThrow(FamilyValidationError);
    expect(() => parseFamilyMembershipInput({
      customerId: CUSTOMER_IDS[0],
      relationshipName: "가".repeat(101),
    })).toThrow(FamilyValidationError);
    expect(() => parseFamilyMembershipUpdateInput({
      relationshipName: null,
      customerId: CUSTOMER_IDS[0],
    })).toThrow(FamilyValidationError);
  });

  it("accepts only canonical UUIDs and bounded normalized search text", () => {
    expect(parseFamilyId(FAMILY_IDS[0])).toBe(FAMILY_IDS[0]);
    expect(parseFamilySearch("  합성 가족  ")).toBe("합성 가족");
    expect(() => parseFamilyId(
      "4000000a-0000-4000-8000-000000000001".toUpperCase(),
    )).toThrow(
      FamilyValidationError,
    );
    expect(() => parseFamilySearch("가".repeat(101))).toThrow(FamilyValidationError);
  });

  it("strictly parses repository and application responses", () => {
    expect(parseFamily(family(FAMILY_IDS[0]))).toEqual(family(FAMILY_IDS[0]));
    expect(() => parseFamily({ ...family(FAMILY_IDS[0]), deletedAt: null })).toThrow(
      FamilyRepositoryError,
    );
    expect(() => parseFamilyCustomerOptionList([
      { id: CUSTOMER_IDS[0], name: "합성 고객", phone: "synthetic-private" },
    ])).toThrow(FamilyRepositoryError);
    expect(() => parseFamilyDetail({
      family: family(FAMILY_IDS[0]),
      members: [{
        membershipId: MEMBERSHIP_IDS[0],
        customerId: CUSTOMER_IDS[0],
        customerName: "합성 고객",
        relationshipName: null,
        totalMonthlyPremiumWon: -1n,
        includedPolicyCount: 1,
      }],
      totalMonthlyPremiumWon: -1n,
    })).toThrow(FamilyRepositoryError);
  });

  it("redacts unknown failures from user-safe messages", () => {
    expect(familySafeMessage(new Error("synthetic private marker"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
    expect(familySafeMessage(
      new FamilyRepositoryError("이미 이 가족에 등록된 고객입니다.", "conflict"),
    )).toBe("이미 이 가족에 등록된 고객입니다.");
  });
});

describe("family premium service", () => {
  it("sums bigint member premiums beyond the SQLite integer range", () => {
    const maximum = 9_223_372_036_854_775_807n;
    expect(sumFamilyMonthlyPremium([maximum, maximum, 0n]))
      .toBe(maximum * 2n);
    expect(sumFamilyMonthlyPremium([])).toBe(0n);
  });
});
