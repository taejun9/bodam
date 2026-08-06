import type { Customer } from "@/features/customer/types/customer";

import type { ConsultationRepository } from "../repositories/consultation-repository";
import {
  parseConsultation,
  parseConsultationId,
  parseConsultationInput,
  parseConsultationList,
} from "../schemas/consultation-schema";
import { sortConsultationsLatestFirst } from "../services/consultation-order";
import type { Consultation, ConsultationInput } from "../types/consultation";
import { ConsultationRepositoryError } from "../types/consultation-error";

export interface ConsultationCustomerReader {
  list(search?: string): Promise<readonly Customer[]>;
}

export class ConsultationApplication {
  constructor(
    private readonly repository: ConsultationRepository,
    private readonly customers: ConsultationCustomerReader,
  ) {}

  async list(customerId: string): Promise<Consultation[]> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    await this.ensureActiveCustomer(parsedCustomerId);
    return sortConsultationsLatestFirst(
      parseConsultationList(await this.repository.list(parsedCustomerId)),
    );
  }

  async create(
    customerId: string,
    input: ConsultationInput,
  ): Promise<Consultation> {
    const parsedCustomerId = parseConsultationId(customerId, "customerId");
    const parsedInput = parseConsultationInput(input);
    await this.ensureActiveCustomer(parsedCustomerId);
    return parseConsultation(
      await this.repository.create(parsedCustomerId, parsedInput),
    );
  }

  async update(id: string, input: ConsultationInput): Promise<Consultation> {
    return parseConsultation(
      await this.repository.update(
        parseConsultationId(id),
        parseConsultationInput(input),
      ),
    );
  }

  async remove(id: string): Promise<void> {
    await this.repository.remove(parseConsultationId(id));
  }

  private async ensureActiveCustomer(customerId: string): Promise<void> {
    let customers: readonly Customer[];
    try {
      customers = await this.customers.list();
    } catch {
      throw new ConsultationRepositoryError("활성 고객을 확인할 수 없습니다.");
    }
    if (!customers.some((customer) => customer.id === customerId)) {
      throw new ConsultationRepositoryError(
        "활성 고객을 찾을 수 없습니다.",
        "customer_not_found",
      );
    }
  }
}
