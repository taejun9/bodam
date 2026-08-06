import { CustomerApplication } from "@/features/customer/application/customer-application";
import { createCustomerRepository } from "@/features/customer/repositories/customer-repository-factory";

export const customerApplication = new CustomerApplication(
  createCustomerRepository(),
);
