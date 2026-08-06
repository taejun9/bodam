import { describe, expect, it } from "vitest";

import { BrowserCustomerRepository } from
  "@/features/customer/repositories/browser-customer-repository";
import type { CustomerRepository } from
  "@/features/customer/repositories/customer-repository";
import type { CustomerInput } from "@/features/customer/types/customer";

import { BrowserScheduleRepository } from
  "../repositories/browser-schedule-repository";
import { BROWSER_SCHEDULE_STORAGE_KEY } from
  "../repositories/browser-schedule-storage";
import { StoredScheduleSchema } from "../schemas/schedule-schema";
import {
  SCHEDULE_CUSTOMER_IDS,
  SCHEDULE_IDS,
  SCHEDULE_TIMESTAMP,
  scheduleInput,
} from "./schedule-test-data";

class MemoryStorage {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve = (): void => undefined;
  const promise = new Promise<void>((accept) => {
    resolve = accept;
  });
  return { promise, resolve };
}

const customerInput: CustomerInput = {
  name: "합성 고객",
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
};

const august = { startOn: "2026-08-01", endBefore: "2026-09-01" };

async function runDeleteRace(mode: "create" | "update"): Promise<void> {
  const storage = new MemoryStorage();
  const customers = new BrowserCustomerRepository({
    storage,
    createId: () => SCHEDULE_CUSTOMER_IDS[0],
    now: () => SCHEDULE_TIMESTAMP,
  });
  const customer = await customers.create(customerInput);
  const enteredCustomerRead = deferred();
  const releaseCustomerRead = deferred();
  let waitForDelete = true;
  const customerReader: Pick<CustomerRepository, "list"> = {
    list: async () => {
      const snapshot = await customers.list({});
      if (waitForDelete) {
        waitForDelete = false;
        enteredCustomerRead.resolve();
        await releaseCustomerRead.promise;
      }
      return snapshot;
    },
  };
  const schedules = new BrowserScheduleRepository({
    storage,
    customerRepository: customerReader,
    createId: () => SCHEDULE_IDS[0],
    now: () => SCHEDULE_TIMESTAMP,
  });
  let scheduleId: string = SCHEDULE_IDS[0];
  if (mode === "update") {
    waitForDelete = false;
    scheduleId = (await schedules.create(scheduleInput())).id;
    waitForDelete = true;
  }

  const write = mode === "create"
    ? schedules.create(scheduleInput({ customerId: customer.id }))
    : schedules.update(scheduleId, scheduleInput({ customerId: customer.id }));
  await enteredCustomerRead.promise;
  let removalFinished = false;
  const remove = customers.remove(customer.id).then(() => {
    removalFinished = true;
  });
  await Promise.resolve();
  expect(removalFinished).toBe(false);

  releaseCustomerRead.resolve();
  await expect(write).resolves.toMatchObject({ customerId: customer.id });
  await remove;
  await expect(schedules.list(august)).resolves.toEqual([]);
  const stored = StoredScheduleSchema.array().parse(
    JSON.parse(storage.getItem(BROWSER_SCHEDULE_STORAGE_KEY) ?? "[]"),
  );
  expect(stored).toMatchObject([{ customerId: customer.id, deletedAt: null }]);
}

describe("Browser Schedule and Customer parent mutation lock", () => {
  it("linearizes linked create before concurrent Customer soft delete", async () => {
    await runDeleteRace("create");
  });

  it("linearizes linked update before concurrent Customer soft delete", async () => {
    await runDeleteRace("update");
  });
});
