import { BrowserCustomerRepository } from "./browser-customer-repository";
import type { CustomerRepository } from "./customer-repository";
import { TauriCustomerRepository } from "./tauri-customer-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createCustomerRepository = (): CustomerRepository =>
  isTauriRuntime() ? new TauriCustomerRepository() : new BrowserCustomerRepository();
