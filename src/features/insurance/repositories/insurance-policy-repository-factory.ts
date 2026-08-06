import { BrowserInsurancePolicyRepository } from "./browser-insurance-policy-repository";
import type { InsurancePolicyRepository } from "./insurance-policy-repository";
import { TauriInsurancePolicyRepository } from "./tauri-insurance-policy-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createInsurancePolicyRepository = (): InsurancePolicyRepository =>
  isTauriRuntime()
    ? new TauriInsurancePolicyRepository()
    : new BrowserInsurancePolicyRepository();
