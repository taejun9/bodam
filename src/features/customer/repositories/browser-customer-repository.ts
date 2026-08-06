import { z } from "zod";

import { withBrowserStorageMutation } from "@/shared/browser-storage-mutation";

import {
  StoredCustomerSchema,
  parseCustomerCreateInput,
  parseCustomerId,
  parseCustomerQuery,
  parseCustomerUpdateInput,
} from "../schemas/customer-schema";
import type { Customer, CustomerInput, CustomerQuery } from "../types/customer";
import { CustomerRepositoryError } from "../types/customer-error";
import type { CustomerRepository } from "./customer-repository";

interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

interface StoredCustomer extends Customer {
  readonly deletedAt: string | null;
}

export interface BrowserCustomerRepositoryOptions {
  readonly storage?: StoragePort;
  readonly now?: () => string;
  readonly createId?: () => string;
}

export const BROWSER_CUSTOMER_STORAGE_KEY = "bodam.preview.synthetic-customers.v1";

const storedCustomersSchema = z.array(StoredCustomerSchema);

const defaultStorage = (): StoragePort => {
  if (typeof window === "undefined") {
    throw new CustomerRepositoryError(
      "브라우저 미리보기 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

const defaultCreateId = (): string => globalThis.crypto.randomUUID();
const defaultNow = (): string => new Date().toISOString();

const notFoundError = (): CustomerRepositoryError =>
  new CustomerRepositoryError("고객을 찾을 수 없습니다.", "not_found");

export class BrowserCustomerRepository implements CustomerRepository {
  private readonly storage: StoragePort;
  private readonly now: () => string;
  private readonly createId: () => string;

  constructor(options: BrowserCustomerRepositoryOptions = {}) {
    this.storage = options.storage ?? defaultStorage();
    this.now = options.now ?? defaultNow;
    this.createId = options.createId ?? defaultCreateId;
  }

  async list(query: CustomerQuery): Promise<Customer[]> {
    const { search } = parseCustomerQuery(query);
    const needle = (search ?? "").toLocaleLowerCase("ko-KR");

    return this.load()
      .filter((customer) => customer.deletedAt === null)
      .filter((customer) => this.matches(customer, needle))
      .sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id),
      )
      .map((customer) => this.toCustomer(customer));
  }

  async create(input: CustomerInput): Promise<Customer> {
    const parsed = parseCustomerCreateInput(input);
    return withBrowserStorageMutation(this.storage, async () => {
      const customers = this.load();
      const id = this.createId();
      if (customers.some((customer) => customer.id === id)) {
        throw new CustomerRepositoryError("고객 식별자를 생성하지 못했습니다.");
      }

      const timestamp = this.now();
      const customer = this.parseStored({
        id,
        ...parsed,
        createdAt: timestamp,
        updatedAt: timestamp,
        deletedAt: null,
      });
      this.save([...customers, customer]);
      return this.toCustomer(customer);
    });
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    const parsedId = parseCustomerId(id);
    const parsed = parseCustomerUpdateInput(input);
    return withBrowserStorageMutation(this.storage, async () => {
      const customers = this.load();
      const index = customers.findIndex(
        (customer) => customer.id === parsedId && customer.deletedAt === null,
      );
      const existing = customers[index];
      if (index < 0 || existing === undefined) {
        throw notFoundError();
      }

      const updated = this.parseStored({
        ...existing,
        ...parsed,
        updatedAt: this.now(),
      });
      customers[index] = updated;
      this.save(customers);
      return this.toCustomer(updated);
    });
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseCustomerId(id);
    return withBrowserStorageMutation(this.storage, async () => {
      const customers = this.load();
      const index = customers.findIndex(
        (customer) => customer.id === parsedId && customer.deletedAt === null,
      );
      const existing = customers[index];
      if (index < 0 || existing === undefined) {
        throw notFoundError();
      }

      const timestamp = this.now();
      customers[index] = this.parseStored({
        ...existing,
        updatedAt: timestamp,
        deletedAt: timestamp,
      });
      this.save(customers);
    });
  }

  private matches(customer: StoredCustomer, needle: string): boolean {
    if (needle.length === 0) {
      return true;
    }
    return [customer.name, customer.phone, customer.status].some((value) =>
      (value ?? "").toLocaleLowerCase("ko-KR").includes(needle),
    );
  }

  private load(): StoredCustomer[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_CUSTOMER_STORAGE_KEY);
    } catch {
      throw new CustomerRepositoryError(
        "미리보기 고객 저장소를 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }

    if (serialized === null) {
      return [];
    }

    try {
      const result = storedCustomersSchema.safeParse(JSON.parse(serialized));
      if (result.success) {
        return result.data;
      }
    } catch {
      // The stored value is handled as corrupt without exposing its contents.
    }
    throw new CustomerRepositoryError(
      "저장된 미리보기 고객 데이터를 읽을 수 없습니다.",
      "storage_corrupt",
    );
  }

  private save(customers: readonly StoredCustomer[]): void {
    try {
      this.storage.setItem(BROWSER_CUSTOMER_STORAGE_KEY, JSON.stringify(customers));
    } catch {
      throw new CustomerRepositoryError(
        "미리보기 고객 저장소에 저장할 수 없습니다.",
        "storage_unavailable",
      );
    }
  }

  private parseStored(value: unknown): StoredCustomer {
    const result = StoredCustomerSchema.safeParse(value);
    if (!result.success) {
      throw new CustomerRepositoryError("고객 데이터를 저장할 수 없습니다.");
    }
    return result.data;
  }

  private toCustomer(customer: StoredCustomer): Customer {
    return {
      id: customer.id,
      name: customer.name,
      birthDate: customer.birthDate,
      gender: customer.gender,
      phone: customer.phone,
      address: customer.address,
      memo: customer.memo,
      status: customer.status,
      isManaged: customer.isManaged,
      createdAt: customer.createdAt,
      updatedAt: customer.updatedAt,
    };
  }
}
