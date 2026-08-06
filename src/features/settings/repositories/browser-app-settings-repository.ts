import { withBrowserStorageMutation } from "@/shared/browser-storage-mutation";

import {
  parseAppSettings,
  parseAppSettingsInput,
} from "../schemas/app-settings-schema";
import {
  DEFAULT_APP_SETTINGS,
  type AppSettings,
  type AppSettingsInput,
} from "../types/app-settings";
import { AppSettingsRepositoryError } from "../types/app-settings-error";
import type { AppSettingsRepository } from "./app-settings-repository";

export interface AppSettingsStoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const BROWSER_APP_SETTINGS_STORAGE_KEY =
  "bodam.preview.synthetic-app-settings.v1";

const defaultStorage = (): AppSettingsStoragePort => {
  if (typeof window === "undefined") {
    throw new AppSettingsRepositoryError(
      "브라우저 미리보기 설정 저장소를 사용할 수 없습니다.",
      "storage_unavailable",
    );
  }
  return window.localStorage;
};

export class BrowserAppSettingsRepository implements AppSettingsRepository {
  constructor(private readonly storage = defaultStorage()) {}

  load(): Promise<AppSettings> {
    return withBrowserStorageMutation(this.storage, async () => this.loadStored());
  }

  update(input: AppSettingsInput): Promise<AppSettings> {
    const parsedInput = parseAppSettingsInput(input);
    return withBrowserStorageMutation(this.storage, async () => {
      const current = this.loadStored();
      const updated = parseAppSettings({ ...current, ...parsedInput });
      try {
        this.storage.setItem(
          BROWSER_APP_SETTINGS_STORAGE_KEY,
          JSON.stringify(updated),
        );
      } catch {
        throw new AppSettingsRepositoryError(
          "브라우저 미리보기 설정을 저장할 수 없습니다.",
          "storage_unavailable",
        );
      }
      return updated;
    });
  }

  private loadStored(): AppSettings {
    let serialized: string | null;
    try {
      serialized = this.storage.getItem(BROWSER_APP_SETTINGS_STORAGE_KEY);
    } catch {
      throw new AppSettingsRepositoryError(
        "브라우저 미리보기 설정을 읽을 수 없습니다.",
        "storage_unavailable",
      );
    }
    if (serialized === null) return parseAppSettings(DEFAULT_APP_SETTINGS);
    try {
      return parseAppSettings(JSON.parse(serialized));
    } catch {
      throw new AppSettingsRepositoryError(
        "저장된 브라우저 미리보기 설정을 읽을 수 없습니다.",
        "storage_corrupt",
      );
    }
  }
}
