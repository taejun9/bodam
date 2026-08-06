import { BrowserCoverageRepository } from "./browser-coverage-repository";
import type { CoverageRepository } from "./coverage-repository";
import { TauriCoverageRepository } from "./tauri-coverage-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createCoverageRepository = (): CoverageRepository =>
  isTauriRuntime()
    ? new TauriCoverageRepository()
    : new BrowserCoverageRepository();
