import { describe, expect, it } from "vitest";

import { InsuranceApplication } from "../application/insurance-application";
import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";
import type { Customer } from "@/features/customer/types/customer";
import {
  BROWSER_INSURANCE_POLICY_STORAGE_KEY,
  BrowserInsurancePolicyRepository,
} from "../repositories/browser-insurance-policy-repository";
import {
  MAX_SQLITE_INTEGER,
  StoredInsurancePolicyWireSchema,
  parseInsurancePolicyInput,
  parseMonthlyPremiumWon,
} from "../schemas/insurance-policy-schema";
import type { InsurancePolicyInput } from "../types/insurance-policy";
import { InsuranceValidationError } from "../types/insurance-error";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const customerOne = "11111111-1111-4111-8111-111111111111";
const customerTwo = "22222222-2222-4222-8222-222222222222";
const policyIds = [
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2",
  "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3",
];

const activeCustomer = (id: string): Customer => ({
  id,
  name: "합성고객",
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: "2026-08-06T01:02:03.000Z",
  updatedAt: "2026-08-06T01:02:03.000Z",
});

const syntheticInput = (
  overrides: Partial<InsurancePolicyInput> = {},
): InsurancePolicyInput => ({
  insurer: "합성보험사",
  productName: "합성 보장상품",
  joinedOn: "2025-01-31",
  coverageTerm: "종신",
  paymentTerm: "20년",
  monthlyPremiumWon: 123_456n,
  disclosurePlan: "합성 일반고지",
  maturesOn: null,
  renewable: false,
  status: "합성 유지",
  isIncluded: true,
  ...overrides,
});

function createApplication(
  storage: MemoryStorage,
  activeCustomerIds: readonly string[] = [customerOne, customerTwo],
): InsuranceApplication {
  let idIndex = 0;
  const customerRepository: Pick<CustomerRepository, "list"> = {
    list: () => Promise.resolve(activeCustomerIds.map(activeCustomer)),
  };
  return new InsuranceApplication(
    new BrowserInsurancePolicyRepository({
      storage,
      now: () => "2026-08-06T01:02:03.000Z",
      createId: () => policyIds[idIndex++] ?? policyIds[2]!,
      customerRepository,
    }),
  );
}

describe("InsuranceApplication validation", () => {
  it("requires strict complete inputs and validates text, money, and dates", async () => {
    const application = createApplication(new MemoryStorage());

    await expect(
      application.create(customerOne, syntheticInput({ insurer: "  " })),
    ).rejects.toBeInstanceOf(InsuranceValidationError);
    await expect(
      application.create(customerOne, syntheticInput({ joinedOn: "2025-02-30" })),
    ).rejects.toBeInstanceOf(InsuranceValidationError);
    await expect(
      application.create(customerOne, syntheticInput({ monthlyPremiumWon: -1n })),
    ).rejects.toBeInstanceOf(InsuranceValidationError);
    await expect(application.list("not-a-canonical-uuid")).rejects.toBeInstanceOf(
      InsuranceValidationError,
    );

    expect(() =>
      parseInsurancePolicyInput({
        ...syntheticInput(),
        unexpected: "not allowed",
      }),
    ).toThrow(InsuranceValidationError);
    const missingStatus = { ...syntheticInput() } as Record<string, unknown>;
    delete missingStatus.status;
    expect(() => parseInsurancePolicyInput(missingStatus)).toThrow(
      InsuranceValidationError,
    );
    expect(() =>
      parseInsurancePolicyInput(
        syntheticInput({ productName: "가".repeat(201) }),
      ),
    ).toThrow(InsuranceValidationError);
  });

  it("accepts only canonical nonnegative SQLite-range decimal money strings", () => {
    expect(parseMonthlyPremiumWon("0")).toBe(0n);
    expect(parseMonthlyPremiumWon(MAX_SQLITE_INTEGER.toString())).toBe(
      MAX_SQLITE_INTEGER,
    );
    for (const value of [" 1", "1 ", "01", "-1", "1.5", ""]) {
      expect(() => parseMonthlyPremiumWon(value)).toThrow(InsuranceValidationError);
    }
    expect(() => parseMonthlyPremiumWon((MAX_SQLITE_INTEGER + 1n).toString())).toThrow(
      InsuranceValidationError,
    );
  });
});

describe("InsuranceApplication with browser preview repository", () => {
  it("isolates customer lists, normalizes values, and sums included policies", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);

    const first = await application.create(
      customerOne,
      syntheticInput({ insurer: "  합성보험사  ", coverageTerm: "   " }),
    );
    await application.create(
      customerOne,
      syntheticInput({
        productName: "합성 제외상품",
        monthlyPremiumWon: 50_000n,
        isIncluded: false,
      }),
    );
    await application.create(
      customerTwo,
      syntheticInput({ monthlyPremiumWon: 900_000n }),
    );

    expect(first.insurer).toBe("합성보험사");
    expect(first.coverageTerm).toBeNull();
    const customerPolicies = await application.list(customerOne);
    expect(customerPolicies).toHaveLength(2);
    expect(application.total(customerPolicies)).toBe(123_456n);
    await expect(application.list(customerTwo)).resolves.toHaveLength(1);

    const serialized = storage.getItem(BROWSER_INSURANCE_POLICY_STORAGE_KEY);
    const stored = StoredInsurancePolicyWireSchema.array().parse(
      JSON.parse(serialized ?? "[]"),
    );
    expect(stored[0]?.monthlyPremiumWon).toBe("123456");
    expect(typeof stored[0]?.monthlyPremiumWon).toBe("string");
  });

  it("updates, soft deletes, and persists without serializing bigint", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);
    const created = await application.create(customerOne, syntheticInput());

    const updated = await application.update(
      created.id,
      syntheticInput({ monthlyPremiumWon: 777_000n, isIncluded: false }),
    );
    expect(updated.monthlyPremiumWon).toBe(777_000n);
    expect(application.total(await application.list(customerOne))).toBe(0n);

    const reloaded = createApplication(storage);
    await expect(reloaded.list(customerOne)).resolves.toMatchObject([
      { id: created.id, monthlyPremiumWon: 777_000n, isIncluded: false },
    ]);
    await reloaded.remove(created.id);
    await expect(reloaded.list(customerOne)).resolves.toEqual([]);
    await expect(reloaded.remove(created.id)).rejects.toMatchObject({
      code: "not_found",
    });

    const stored = StoredInsurancePolicyWireSchema.array().parse(
      JSON.parse(storage.getItem(BROWSER_INSURANCE_POLICY_STORAGE_KEY) ?? "[]"),
    );
    expect(stored[0]?.deletedAt).not.toBeNull();
    expect(stored[0]?.monthlyPremiumWon).toBe("777000");
  });

  it("reports corrupt preview storage without exposing its contents", async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_INSURANCE_POLICY_STORAGE_KEY, "synthetic-secret-value");

    await expect(createApplication(storage).list(customerOne)).rejects.toEqual(
      expect.objectContaining({
        code: "storage_corrupt",
        message: "저장된 미리보기 보험계약 데이터를 읽을 수 없습니다.",
      }),
    );
  });

  it("keeps child rows but blocks access after the parent becomes inactive", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);
    const created = await application.create(customerOne, syntheticInput());

    const withoutActiveParent = createApplication(storage, [customerTwo]);
    await expect(withoutActiveParent.list(customerOne)).rejects.toMatchObject({
      code: "customer_not_found",
    });
    await expect(
      withoutActiveParent.update(created.id, syntheticInput()),
    ).rejects.toMatchObject({ code: "customer_not_found" });
    await expect(withoutActiveParent.remove(created.id)).rejects.toMatchObject({
      code: "customer_not_found",
    });
    await expect(
      withoutActiveParent.create(customerOne, syntheticInput()),
    ).rejects.toMatchObject({ code: "customer_not_found" });

    const stored = StoredInsurancePolicyWireSchema.array().parse(
      JSON.parse(storage.getItem(BROWSER_INSURANCE_POLICY_STORAGE_KEY) ?? "[]"),
    );
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(created.id);
    expect(stored[0]?.deletedAt).toBeNull();
  });
});
