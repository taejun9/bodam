import { describe, expect, it, vi } from "vitest";

import {
  BROWSER_APP_SETTINGS_STORAGE_KEY,
  BrowserAppSettingsRepository,
  type AppSettingsStoragePort,
} from "../repositories/browser-app-settings-repository";
import {
  TauriAppSettingsRepository,
  type AppSettingsInvoke,
} from "../repositories/tauri-app-settings-repository";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_SETTINGS_INPUT,
} from "../types/app-settings";
import { AppSettingsRepositoryError } from "../types/app-settings-error";

class MemoryStorage implements AppSettingsStoragePort {
  private readonly values = new Map<string, string>();

  getItem(key: string): string | null {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.values.set(key, value);
  }
}

describe("BrowserAppSettingsRepository", () => {
  it("loads defaults and persists the same strict synthetic contract", async () => {
    const storage = new MemoryStorage();
    const repository = new BrowserAppSettingsRepository(storage);
    expect(await repository.load()).toEqual(DEFAULT_APP_SETTINGS);

    const updated = await repository.update({
      theme: "dark",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    expect(updated).toEqual({
      theme: "dark",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
      backupDirectory: { kind: "default", basename: null },
    });
    expect(await repository.load()).toEqual(updated);
  });

  it("reports corrupt storage without echoing its contents", async () => {
    const storage = new MemoryStorage();
    storage.setItem(BROWSER_APP_SETTINGS_STORAGE_KEY, "private-marker{");
    const repository = new BrowserAppSettingsRepository(storage);

    await expect(repository.load()).rejects.toMatchObject({
      name: "AppSettingsRepositoryError",
      code: "storage_corrupt",
    });
    await expect(repository.load()).rejects.not.toThrow("private-marker");
  });
});

describe("TauriAppSettingsRepository", () => {
  it("uses exact commands and excludes backup metadata from update input", async () => {
    const response = {
      ...DEFAULT_APP_SETTINGS,
      theme: "dark" as const,
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    };
    const invokeCommand = vi.fn(async (command: string) => {
      expect(["load_app_settings", "update_app_settings"]).toContain(command);
      return response;
    });
    const repository = new TauriAppSettingsRepository(
      invokeCommand as unknown as AppSettingsInvoke,
    );

    expect(await repository.load()).toEqual(response);
    expect(await repository.update({
      theme: "dark",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    })).toEqual(response);
    expect(invokeCommand).toHaveBeenNthCalledWith(1, "load_app_settings");
    expect(invokeCommand).toHaveBeenNthCalledWith(2, "update_app_settings", {
      input: {
        theme: "dark",
        recentConsultationDays: 45,
        unconsultedDays: 120,
        dashboardItemLimit: 7,
      },
    });
  });

  it("rejects malformed responses and hides unknown native details", async () => {
    const malformedInvoke: AppSettingsInvoke = async <T>() => ({
      ...DEFAULT_APP_SETTINGS_INPUT,
      backupDirectory: { kind: "custom", basename: "bad/path" },
    } as T);
    const malformed = new TauriAppSettingsRepository(malformedInvoke);
    await expect(malformed.load()).rejects.toBeInstanceOf(
      AppSettingsRepositoryError,
    );

    const privateFailure = new TauriAppSettingsRepository(async <T>(): Promise<T> => {
      throw new Error("private-native-marker");
    });
    await expect(privateFailure.load()).rejects.not.toThrow(
      "private-native-marker",
    );
  });
});
