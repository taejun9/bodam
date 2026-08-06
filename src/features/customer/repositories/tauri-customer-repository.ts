import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseCustomer,
  parseCustomerCreateInput,
  parseCustomerDeleteResult,
  parseCustomerId,
  parseCustomerList,
  parseCustomerQuery,
  parseCustomerUpdateInput,
} from "../schemas/customer-schema";
import type { Customer, CustomerInput, CustomerQuery } from "../types/customer";
import { CustomerRepositoryError } from "../types/customer-error";
import type { CustomerRepository } from "./customer-repository";

export type CustomerInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: CustomerInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z
  .object({
    code: z.string(),
  })
  .passthrough();

const decodeCommandError = (error: unknown): z.infer<typeof commandErrorSchema> | null => {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data ?? null;
    } catch {
      return commandErrorSchema.safeParse({ code: error }).data ?? null;
    }
  }

  return commandErrorSchema.safeParse(error).data ?? null;
};

const repositoryErrorFrom = (error: unknown): CustomerRepositoryError => {
  if (error instanceof CustomerRepositoryError) {
    return error;
  }

  const code = decodeCommandError(error)?.code.toLocaleLowerCase("en-US") ?? "";
  if (code.includes("not_found")) {
    return new CustomerRepositoryError("고객을 찾을 수 없습니다.", "not_found");
  }
  if (code.includes("validation") || code.includes("invalid")) {
    return new CustomerRepositoryError("입력 내용을 확인해 주세요.");
  }

  return new CustomerRepositoryError("고객 데이터를 처리하지 못했습니다.");
};

export class TauriCustomerRepository implements CustomerRepository {
  constructor(private readonly invokeCommand: CustomerInvoke = defaultInvoke) {}

  async list(query: CustomerQuery): Promise<Customer[]> {
    const parsed = parseCustomerQuery(query);
    return this.execute(async () =>
      parseCustomerList(
        await this.invokeCommand<unknown>("list_customers", {
          search: parsed.search ?? null,
        }),
      ),
    );
  }

  async create(input: CustomerInput): Promise<Customer> {
    const parsed = parseCustomerCreateInput(input);
    return this.execute(async () =>
      parseCustomer(
        await this.invokeCommand<unknown>("create_customer", { input: parsed }),
      ),
    );
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    const parsedId = parseCustomerId(id);
    const parsed = parseCustomerUpdateInput(input);
    return this.execute(async () =>
      parseCustomer(
        await this.invokeCommand<unknown>("update_customer", {
          id: parsedId,
          input: parsed,
        }),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    const parsedId = parseCustomerId(id);
    await this.execute(async () => {
      const result = parseCustomerDeleteResult(
        await this.invokeCommand<unknown>("delete_customer", { id: parsedId }),
      );
      if (result.id !== parsedId) {
        throw new CustomerRepositoryError("고객 삭제 응답을 확인할 수 없습니다.");
      }
    });
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw repositoryErrorFrom(error);
    }
  }
}
