import type { Consultation, ConsultationInput } from "../types/consultation";

export interface ConsultationRepository {
  list(customerId: string): Promise<Consultation[]>;
  create(customerId: string, input: ConsultationInput): Promise<Consultation>;
  update(id: string, input: ConsultationInput): Promise<Consultation>;
  remove(id: string): Promise<void>;
}
