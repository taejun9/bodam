import { describe, expect, it } from "vitest";

import {
  TauriCustomerRepository,
  type CustomerInvoke,
} from "../repositories/tauri-customer-repository";
import type { Customer, CustomerInput } from "../types/customer";

const input: CustomerInput = {
  name: "합성고객 감마",
  birthDate: null,
  gender: null,
  phone: "000-0000-0003",
  address: null,
  memo: null,
  status: "테스트",
  isManaged: true,
};

const customer: Customer = {
  id: "synthetic-customer-3",
  ...input,
  createdAt: "2026-08-06T01:02:03.000Z",
  updatedAt: "2026-08-06T01:02:03.000Z",
};

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

describe("TauriCustomerRepository", () => {
  it("uses the approved command names and top-level invoke payloads", async () => {
    const calls: Invocation[] = [];
    const invokeCommand: CustomerInvoke = <T>(
      command: string,
      args?: Record<string, unknown>,
    ): Promise<T> => {
      calls.push({ command, args });
      const responses: Record<string, unknown> = {
        list_customers: [customer],
        create_customer: customer,
        update_customer: { ...customer, name: "합성고객 감마 수정" },
        delete_customer: { id: customer.id },
      };
      return Promise.resolve(responses[command] as T);
    };
    const repository = new TauriCustomerRepository(invokeCommand);

    await repository.list({ search: "  감마  " });
    await repository.create(input);
    await repository.update(customer.id, { ...input, name: "합성고객 감마 수정" });
    await repository.remove(customer.id);

    expect(calls).toEqual([
      { command: "list_customers", args: { search: "감마" } },
      { command: "create_customer", args: { input } },
      {
        command: "update_customer",
        args: { id: customer.id, input: { ...input, name: "합성고객 감마 수정" } },
      },
      { command: "delete_customer", args: { id: customer.id } },
    ]);
  });

  it("rejects malformed IPC responses without exposing their contents", async () => {
    const invokeCommand: CustomerInvoke = <T>(): Promise<T> =>
      Promise.resolve({ unexpected: "synthetic-value" } as T);
    const repository = new TauriCustomerRepository(invokeCommand);

    await expect(repository.list({})).rejects.toEqual(
      expect.objectContaining({
        code: "unexpected",
        message: "고객 데이터 응답을 확인할 수 없습니다.",
      }),
    );
  });

  it("maps native failures to safe customer errors", async () => {
    const invokeCommand: CustomerInvoke = <T>(): Promise<T> =>
      Promise.reject(new Error("synthetic database detail"));
    const repository = new TauriCustomerRepository(invokeCommand);

    await expect(repository.create(input)).rejects.toEqual(
      expect.objectContaining({
        code: "unexpected",
        message: "고객 데이터를 처리하지 못했습니다.",
      }),
    );
  });
});
