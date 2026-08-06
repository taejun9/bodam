import { z } from "zod";

import { StoredConsultationSchema } from "../schemas/consultation-schema";
import { ConsultationRepositoryError } from "../types/consultation-error";

export interface ConsultationStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export type StoredConsultation = z.infer<typeof StoredConsultationSchema>;

export const BROWSER_CONSULTATION_STORAGE_KEY =
  "bodam.preview.synthetic-consultations.v1";

const storedConsultationListSchema = z
  .array(StoredConsultationSchema)
  .refine((consultations) => {
    const ids = new Set(consultations.map((consultation) => consultation.id));
    return ids.size === consultations.length;
  });

export class BrowserConsultationStorage {
  constructor(private readonly storage: ConsultationStoragePort) {}

  load(): StoredConsultation[] {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_CONSULTATION_STORAGE_KEY);
    } catch {
      throw new ConsultationRepositoryError(
        "미리보기 상담 저장소를 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }
    if (serialized === null) return [];

    try {
      const result = storedConsultationListSchema.safeParse(JSON.parse(serialized));
      if (result.success) return result.data;
    } catch {
      // Corrupt storage is reported without exposing its contents.
    }
    throw new ConsultationRepositoryError(
      "저장된 미리보기 상담 데이터를 읽을 수 없습니다.",
      "storage_corrupt",
    );
  }

  save(consultations: readonly StoredConsultation[]): void {
    try {
      this.storage.setItem(
        BROWSER_CONSULTATION_STORAGE_KEY,
        JSON.stringify(consultations),
      );
    } catch {
      throw new ConsultationRepositoryError(
        "미리보기 상담 저장소에 저장할 수 없습니다.",
        "storage_unavailable",
      );
    }
  }
}
