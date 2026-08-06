import { describe, expect, it } from "vitest";

import type { CustomerRepository } from "@/features/customer/repositories/customer-repository";
import type { Customer } from "@/features/customer/types/customer";

import { BrowserFamilyRepository } from "../repositories/browser-family-repository";
import {
  BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY,
  BROWSER_FAMILY_STORAGE_KEY,
  BrowserFamilyStorage,
  type FamilyStoragePort,
} from "../repositories/browser-family-storage";
import {
  CUSTOMER_IDS,
  FAMILY_IDS,
  MEMBERSHIP_IDS,
  TEST_TIMESTAMP,
  customer,
  family,
  membership,
} from "./family-test-data";

class MemoryStorage implements FamilyStoragePort {
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
  now: () => string = () => TEST_TIMESTAMP,
): BrowserFamilyRepository {
  let idIndex = 0;
  const customerRepository: Pick<CustomerRepository, "list"> = {
    list: () => Promise.resolve([...activeCustomers()]),
  };
  return new BrowserFamilyRepository({
    storage,
    customerRepository,
    now,
    createId: () => ids[idIndex++] ?? MEMBERSHIP_IDS[3],
  });
}

describe("BrowserFamilyRepository families", () => {
  it("allows duplicate names, searches stably, updates, and soft deletes", async () => {
    const storage = new MemoryStorage();
    const familyRepository = repository(
      storage,
      () => [],
      [FAMILY_IDS[1], FAMILY_IDS[0]],
    );

    await familyRepository.create({ name: "  합성 같은 가족  " });
    await familyRepository.create({ name: "합성 같은 가족" });
    const listed = await familyRepository.list("  같은  ");
    expect(listed.map(({ id }) => id)).toEqual([FAMILY_IDS[0], FAMILY_IDS[1]]);

    await expect(familyRepository.update(FAMILY_IDS[0], { name: "  합성 수정  " }))
      .resolves.toMatchObject({ name: "합성 수정" });
    await familyRepository.remove(FAMILY_IDS[1]);
    await expect(familyRepository.list("")).resolves.toMatchObject([
      { id: FAMILY_IDS[0], name: "합성 수정" },
    ]);

    const stored = JSON.parse(storage.getItem(BROWSER_FAMILY_STORAGE_KEY) ?? "[]") as Array<{
      id: string;
      deletedAt: string | null;
    }>;
    expect(stored).toHaveLength(2);
    expect(stored.find((item) => item.id === FAMILY_IDS[1])?.deletedAt)
      .toBe(TEST_TIMESTAMP);
  });

  it("matches SQLite NOCASE by folding ASCII while keeping Unicode exact", async () => {
    const storage = new MemoryStorage();
    const familyRepository = repository(storage, () => [], [FAMILY_IDS[0]]);
    await familyRepository.create({ name: "Élodie Family" });

    await expect(familyRepository.list("ÉLODIE FAMILY")).resolves.toHaveLength(1);
    await expect(familyRepository.list("é")).resolves.toEqual([]);
  });
});

describe("BrowserFamilyRepository memberships", () => {
  it("keeps a raw unique pair and reactivates its existing id with the new label", async () => {
    const storage = new MemoryStorage();
    let timestamp = TEST_TIMESTAMP;
    const familyRepository = repository(
      storage,
      () => [customer(CUSTOMER_IDS[0], "합성 고객")],
      [FAMILY_IDS[0], MEMBERSHIP_IDS[0], MEMBERSHIP_IDS[1]],
      () => timestamp,
    );
    await familyRepository.create({ name: "합성 가족" });
    const created = await familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: "  합성 관계  ",
    });
    expect(created).toMatchObject({
      id: MEMBERSHIP_IDS[0],
      relationshipName: "합성 관계",
    });
    await expect(familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: null,
    })).rejects.toMatchObject({ code: "conflict" });

    timestamp = "2026-08-06T02:00:00.000Z";
    await familyRepository.removeMembership(FAMILY_IDS[0], MEMBERSHIP_IDS[0]);
    expect(await familyRepository.listMemberships(FAMILY_IDS[0])).toEqual([]);
    timestamp = "2026-08-06T03:00:00.000Z";
    const reactivated = await familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: "합성 새 관계",
    });
    expect(reactivated).toMatchObject({
      id: MEMBERSHIP_IDS[0],
      relationshipName: "합성 새 관계",
      createdAt: TEST_TIMESTAMP,
      updatedAt: timestamp,
    });

    const stored = JSON.parse(
      storage.getItem(BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY) ?? "[]",
    ) as Array<{ id: string; deletedAt: string | null }>;
    expect(stored).toEqual([expect.objectContaining({
      id: MEMBERSHIP_IDS[0],
      deletedAt: null,
    })]);
  });

  it("enforces active Family and Customer parents while retaining relationship rows", async () => {
    const storage = new MemoryStorage();
    let customers: readonly Customer[] = [customer(CUSTOMER_IDS[0], "합성 고객")];
    const familyRepository = repository(
      storage,
      () => customers,
      [FAMILY_IDS[0], MEMBERSHIP_IDS[0]],
    );
    await familyRepository.create({ name: "합성 가족" });
    await familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: null,
    });

    customers = [];
    await expect(familyRepository.listMemberships(FAMILY_IDS[0])).resolves.toEqual([]);
    await expect(familyRepository.updateMembership(
      FAMILY_IDS[0],
      MEMBERSHIP_IDS[0],
      { relationshipName: "숨김 관계" },
    )).rejects.toMatchObject({ code: "membership_not_found" });
    await expect(familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[1],
      relationshipName: null,
    })).rejects.toMatchObject({ code: "customer_not_found" });

    customers = [customer(CUSTOMER_IDS[0], "합성 고객")];
    await familyRepository.remove(FAMILY_IDS[0]);
    await expect(familyRepository.listMemberships(FAMILY_IDS[0]))
      .rejects.toMatchObject({ code: "not_found" });
    const retained = JSON.parse(
      storage.getItem(BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY) ?? "[]",
    ) as Array<{ deletedAt: string | null }>;
    expect(retained).toMatchObject([{ deletedAt: null }]);
  });

  it("sorts active memberships by Customer name and stable ids", async () => {
    const storage = new MemoryStorage();
    const familyRepository = repository(
      storage,
      () => [
        customer(CUSTOMER_IDS[0], "합성 나 고객"),
        customer(CUSTOMER_IDS[2], "합성 가 고객"),
      ],
      [FAMILY_IDS[0], MEMBERSHIP_IDS[0], MEMBERSHIP_IDS[1]],
    );
    await familyRepository.create({ name: "합성 가족" });
    await familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[0],
      relationshipName: null,
    });
    await familyRepository.addMembership(FAMILY_IDS[0], {
      customerId: CUSTOMER_IDS[2],
      relationshipName: null,
    });

    await expect(familyRepository.listMemberships(FAMILY_IDS[0])).resolves
      .toMatchObject([
        { customerId: CUSTOMER_IDS[2] },
        { customerId: CUSTOMER_IDS[0] },
      ]);
  });

  it("rejects duplicate raw ids and membership pairs as corrupt storage", () => {
    const storage = new MemoryStorage();
    const browserStorage = new BrowserFamilyStorage(storage);
    const storedFamily = { ...family(FAMILY_IDS[0]), deletedAt: null };
    storage.setItem(
      BROWSER_FAMILY_STORAGE_KEY,
      JSON.stringify([storedFamily, storedFamily]),
    );
    expect(() => browserStorage.loadFamilies()).toThrow(
      "저장된 미리보기 가족 데이터를 읽을 수 없습니다.",
    );

    const storedMembership = {
      ...membership(MEMBERSHIP_IDS[0], FAMILY_IDS[0], CUSTOMER_IDS[0]),
      deletedAt: null,
    };
    storage.setItem(
      BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY,
      JSON.stringify([
        storedMembership,
        { ...storedMembership, id: MEMBERSHIP_IDS[1] },
      ]),
    );
    expect(() => browserStorage.loadMemberships()).toThrow(
      "저장된 미리보기 가족 구성원 관계 데이터를 읽을 수 없습니다.",
    );

    storage.setItem(
      BROWSER_FAMILY_MEMBERSHIP_STORAGE_KEY,
      JSON.stringify([
        storedMembership,
        { ...storedMembership, customerId: CUSTOMER_IDS[1] },
      ]),
    );
    expect(() => browserStorage.loadMemberships()).toThrow(
      "저장된 미리보기 가족 구성원 관계 데이터를 읽을 수 없습니다.",
    );
  });

  it("reports corrupt versioned storage without echoing its contents", async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_FAMILY_STORAGE_KEY, "synthetic-private-family-marker");
    await expect(repository(storage, () => [], []).list(""))
      .rejects.toMatchObject({
        code: "storage_corrupt",
        message: "저장된 미리보기 가족 데이터를 읽을 수 없습니다.",
      });
  });
});
