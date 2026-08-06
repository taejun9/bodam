import {
  ConsultationSchema,
  StoredConsultationSchema,
  parseConsultation,
} from "../schemas/consultation-schema";
import type { Consultation } from "../types/consultation";
import { ConsultationRepositoryError } from "../types/consultation-error";
import type { StoredConsultation } from "./browser-consultation-storage";

export function parseStoredConsultation(value: unknown): StoredConsultation {
  const result = StoredConsultationSchema.safeParse(value);
  if (!result.success) {
    throw new ConsultationRepositoryError("상담 데이터를 저장할 수 없습니다.");
  }
  return result.data;
}

export function consultationFromStored(
  consultation: StoredConsultation,
): Consultation {
  return parseConsultation(ConsultationSchema.parse({
    id: consultation.id,
    customerId: consultation.customerId,
    consultedAt: consultation.consultedAt,
    content: consultation.content,
    nextContactOn: consultation.nextContactOn,
    result: consultation.result,
    createdAt: consultation.createdAt,
    updatedAt: consultation.updatedAt,
  }));
}
