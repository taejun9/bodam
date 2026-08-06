import { BrowserConsultationRepository } from "./browser-consultation-repository";
import type { ConsultationRepository } from "./consultation-repository";
import { TauriConsultationRepository } from "./tauri-consultation-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createConsultationRepository = (): ConsultationRepository =>
  isTauriRuntime()
    ? new TauriConsultationRepository()
    : new BrowserConsultationRepository();
