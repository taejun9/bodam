import { BrowserCoverageBenchmarkRepository } from "./browser-coverage-benchmark-repository";
import type { CoverageBenchmarkRepository } from "./coverage-benchmark-repository";
import { TauriCoverageBenchmarkRepository } from "./tauri-coverage-benchmark-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createCoverageBenchmarkRepository = (): CoverageBenchmarkRepository =>
  isTauriRuntime()
    ? new TauriCoverageBenchmarkRepository()
    : new BrowserCoverageBenchmarkRepository();
