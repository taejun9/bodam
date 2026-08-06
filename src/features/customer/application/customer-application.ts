import type { CustomerRepository } from "../repositories/customer-repository";
import {
  parseCustomer,
  parseCustomerCreateInput,
  parseCustomerId,
  parseCustomerList,
  parseCustomerQuery,
  parseCustomerUpdateInput,
} from "../schemas/customer-schema";
import type { Customer, CustomerInput } from "../types/customer";

export class CustomerApplication {
  constructor(private readonly repository: CustomerRepository) {}

  async list(search?: string): Promise<Customer[]> {
    const query = parseCustomerQuery(search === undefined ? {} : { search });
    return parseCustomerList(await this.repository.list(query));
  }

  async create(input: CustomerInput): Promise<Customer> {
    const parsed = parseCustomerCreateInput(input);
    return parseCustomer(await this.repository.create(parsed));
  }

  async update(id: string, input: CustomerInput): Promise<Customer> {
    const parsedId = parseCustomerId(id);
    const parsed = parseCustomerUpdateInput(input);
    return parseCustomer(await this.repository.update(parsedId, parsed));
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseCustomerId(id));
  }
}
