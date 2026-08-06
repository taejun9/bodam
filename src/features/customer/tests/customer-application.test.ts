import { describe, expect, it } from "vitest";

import { CustomerApplication } from "../application/customer-application";
import {
  BROWSER_CUSTOMER_STORAGE_KEY,
  BrowserCustomerRepository,
} from "../repositories/browser-customer-repository";
import { StoredCustomerSchema } from "../schemas/customer-schema";
import type { CustomerInput } from "../types/customer";
import { CustomerValidationError } from "../types/customer-error";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

const syntheticInput = (
  overrides: Partial<CustomerInput> = {},
): CustomerInput => ({
  name: "합성고객 알파",
  birthDate: "1990-01-15",
  gender: "합성",
  phone: "000-0000-0001",
  address: "테스트 전용 가상 주소",
  memo: "자동화 테스트용 합성 메모",
  status: "테스트 관리중",
  isManaged: true,
  ...overrides,
});

const createApplication = (storage: MemoryStorage): CustomerApplication => {
  let id = 0;
  return new CustomerApplication(
    new BrowserCustomerRepository({
      storage,
      now: () => "2026-08-06T01:02:03.000Z",
      createId: () => `synthetic-customer-${(id += 1)}`,
    }),
  );
};

describe("CustomerApplication with browser preview repository", () => {
  it("validates required name and calendar dates before persistence", async () => {
    const application = createApplication(new MemoryStorage());

    await expect(
      application.create(syntheticInput({ name: "   " })),
    ).rejects.toBeInstanceOf(CustomerValidationError);
    await expect(
      application.create(syntheticInput({ birthDate: "2025-02-30" })),
    ).rejects.toBeInstanceOf(CustomerValidationError);
    await expect(application.list("가".repeat(101))).rejects.toBeInstanceOf(
      CustomerValidationError,
    );
  });

  it("creates, normalizes, searches, updates, and persists synthetic customers", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);

    const alpha = await application.create(
      syntheticInput({ name: "  합성고객 알파  ", memo: "   " }),
    );
    await application.create(
      syntheticInput({
        name: "합성고객 베타",
        phone: "000-0000-0099",
        status: "테스트 대기",
      }),
    );

    expect(alpha.name).toBe("합성고객 알파");
    expect(alpha.memo).toBeNull();
    expect(await application.list("  베타  ")).toHaveLength(1);
    expect(await application.list("0099")).toHaveLength(1);
    expect(await application.list("대기")).toHaveLength(1);

    const updated = await application.update(
      alpha.id,
      syntheticInput({ name: "합성고객 알파 수정", phone: null }),
    );
    expect(updated.name).toBe("합성고객 알파 수정");
    expect(updated.phone).toBeNull();

    const reloaded = createApplication(storage);
    await expect(reloaded.list()).resolves.toHaveLength(2);
    await expect(reloaded.list("알파 수정")).resolves.toHaveLength(1);
  });

  it("soft deletes records and excludes them from active and reloaded lists", async () => {
    const storage = new MemoryStorage();
    const application = createApplication(storage);
    const customer = await application.create(syntheticInput());

    await application.remove(customer.id);

    await expect(application.list()).resolves.toEqual([]);
    await expect(application.remove(customer.id)).rejects.toMatchObject({
      code: "not_found",
    });

    const serialized = storage.getItem(BROWSER_CUSTOMER_STORAGE_KEY);
    expect(serialized).not.toBeNull();
    const stored = StoredCustomerSchema.array().parse(JSON.parse(serialized ?? "[]"));
    expect(stored).toHaveLength(1);
    expect(stored[0]?.id).toBe(customer.id);
    expect(stored[0]?.deletedAt).not.toBeNull();

    const reloaded = createApplication(storage);
    await expect(reloaded.list()).resolves.toEqual([]);
  });

  it("returns a safe error when preview storage is corrupt", async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_CUSTOMER_STORAGE_KEY, "not-json");

    await expect(createApplication(storage).list()).rejects.toEqual(
      expect.objectContaining({
        code: "storage_corrupt",
        message: "저장된 미리보기 고객 데이터를 읽을 수 없습니다.",
      }),
    );
  });
});
