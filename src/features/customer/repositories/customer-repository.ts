import type { Customer, CustomerInput, CustomerQuery } from "../types/customer";

export interface CustomerRepository {
  list(query: CustomerQuery): Promise<Customer[]>;
  create(input: CustomerInput): Promise<Customer>;
  update(id: string, input: CustomerInput): Promise<Customer>;
  remove(id: string): Promise<void>;
}
