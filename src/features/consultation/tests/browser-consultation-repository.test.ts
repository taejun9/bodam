import { describe, expect, it } from "vitest";

import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";
import type { Customer } from "@/features/customer/types/customer";

import { BrowserConsultationRepository } from "../repositories/browser-consultation-repository";
import {
  BROWSER_CONSULTATION_STORAGE_KEY,
  BrowserConsultationStorage,
  type ConsultationStoragePort,
} from "../repositories/browser-consultation-storage";
import {
  CONSULTATION_IDS,
  CUSTOMER_IDS,
  TEST_TIMESTAMP,
  consultation,
  consultationInput,
  customer,
} from "./consultation-test-data";

class MemoryStorage implements ConsultationStoragePort {
  readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function repository(
  storage: MemoryStorage,
  activeCustomers: () => readonly Customer[],
  ids: readonly string[],
  now: () => string,
): BrowserConsultationRepository {
  let idIndex = 0;
  const customerRepository: Pick<CustomerRepository, "list"> = {
    list: () => Promise.resolve([...activeCustomers()]),
  };
  return new BrowserConsultationRepository({
    storage,
    customerRepository,
    now,
    createId: () => ids[idIndex++] ?? CONSULTATION_IDS[2],
  });
}

describe("BrowserConsultationRepository", () => {
  it("keeps duplicate instants, normalizes writes, sorts, updates, and soft deletes", async () => {
    const storage = new MemoryStorage();
    let timestamp = TEST_TIMESTAMP;
    const consultationRepository = repository(
      storage,
      () => [customer()],
      [CONSULTATION_IDS[1], CONSULTATION_IDS[0]],
      () => timestamp,
    );

    await consultationRepository.create(CUSTOMER_IDS[0], {
      ...consultationInput("2026-08-06T10:02:03+09:00"),
      content: "  합성 첫 내용  ",
    });
    await consultationRepository.create(CUSTOMER_IDS[0], consultationInput());
    await expect(consultationRepository.list(CUSTOMER_IDS[0])).resolves.toMatchObject([
      { id: CONSULTATION_IDS[0], consultedAt: TEST_TIMESTAMP },
      { id: CONSULTATION_IDS[1], consultedAt: TEST_TIMESTAMP, content: "합성 첫 내용" },
    ]);

    timestamp = "2026-08-06T02:00:00.000Z";
    await consultationRepository.update(
      CONSULTATION_IDS[1],
      consultationInput("2026-08-07T00:00:00.000Z"),
    );
    await expect(consultationRepository.list(CUSTOMER_IDS[0])).resolves.toMatchObject([
      { id: CONSULTATION_IDS[1] },
      { id: CONSULTATION_IDS[0] },
    ]);

    timestamp = "2026-08-06T03:00:00.000Z";
    await consultationRepository.remove(CONSULTATION_IDS[1]);
    await expect(consultationRepository.list(CUSTOMER_IDS[0])).resolves.toMatchObject([
      { id: CONSULTATION_IDS[0] },
    ]);
    const stored = JSON.parse(
      storage.getItem(BROWSER_CONSULTATION_STORAGE_KEY) ?? "[]",
    ) as Array<{ id: string; deletedAt: string | null }>;
    expect(stored.find(({ id }) => id === CONSULTATION_IDS[1])?.deletedAt)
      .toBe(timestamp);
  });

  it("requires an active Customer while retaining stored Consultation rows", async () => {
    const storage = new MemoryStorage();
    let customers: readonly Customer[] = [customer()];
    const consultationRepository = repository(
      storage,
      () => customers,
      [CONSULTATION_IDS[0]],
      () => TEST_TIMESTAMP,
    );
    await consultationRepository.create(CUSTOMER_IDS[0], consultationInput());
    customers = [];

    await expect(consultationRepository.list(CUSTOMER_IDS[0]))
      .rejects.toMatchObject({ code: "customer_not_found" });
    await expect(consultationRepository.update(
      CONSULTATION_IDS[0],
      consultationInput(),
    )).rejects.toMatchObject({ code: "not_found" });
    await expect(consultationRepository.remove(CONSULTATION_IDS[0]))
      .rejects.toMatchObject({ code: "not_found" });
    await expect(consultationRepository.create(
      CUSTOMER_IDS[1],
      consultationInput(),
    )).rejects.toMatchObject({ code: "customer_not_found" });
    expect(JSON.parse(storage.getItem(BROWSER_CONSULTATION_STORAGE_KEY) ?? "[]"))
      .toHaveLength(1);
  });

  it("rejects duplicate ids and corrupt storage without exposing stored values", async () => {
    const storage = new MemoryStorage();
    const stored = { ...consultation(CONSULTATION_IDS[0]), deletedAt: null };
    storage.setItem(BROWSER_CONSULTATION_STORAGE_KEY, JSON.stringify([stored, stored]));
    expect(() => new BrowserConsultationStorage(storage).load()).toThrow(
      "저장된 미리보기 상담 데이터를 읽을 수 없습니다.",
    );

    storage.setItem(BROWSER_CONSULTATION_STORAGE_KEY, "synthetic-private-marker");
    await expect(repository(
      storage,
      () => [customer()],
      [],
      () => TEST_TIMESTAMP,
    ).list(CUSTOMER_IDS[0])).rejects.toMatchObject({
      code: "storage_corrupt",
      message: "저장된 미리보기 상담 데이터를 읽을 수 없습니다.",
    });
  });
});
