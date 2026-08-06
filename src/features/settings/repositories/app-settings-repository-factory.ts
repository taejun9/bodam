import { BrowserAppSettingsRepository } from "./browser-app-settings-repository";
import type { AppSettingsRepository } from "./app-settings-repository";
import { TauriAppSettingsRepository } from "./tauri-app-settings-repository";

const isTauriRuntime = (): boolean =>
  typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;

export const createAppSettingsRepository = (): AppSettingsRepository =>
  isTauriRuntime()
    ? new TauriAppSettingsRepository()
    : new BrowserAppSettingsRepository();
