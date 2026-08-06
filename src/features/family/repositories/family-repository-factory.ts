import { BrowserFamilyRepository } from "./browser-family-repository";
import type { FamilyRepository } from "./family-repository";
import { TauriFamilyRepository } from "./tauri-family-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createFamilyRepository = (): FamilyRepository =>
  isTauriRuntime()
    ? new TauriFamilyRepository()
    : new BrowserFamilyRepository();
