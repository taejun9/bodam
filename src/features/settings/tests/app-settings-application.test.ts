import { describe, expect, it, vi } from "vitest";

import { AppSettingsApplication } from "../application/app-settings-application";
import type { AppSettingsRepository } from "../repositories/app-settings-repository";
import { DEFAULT_APP_SETTINGS, type AppSettings } from "../types/app-settings";

describe("AppSettingsApplication", () => {
  it("updates a theme from fresh canonical settings without sending backup metadata", async () => {
    const repository: AppSettingsRepository = {
      load: vi.fn().mockResolvedValue({
        ...DEFAULT_APP_SETTINGS,
        recentConsultationDays: 45,
        unconsultedDays: 120,
        dashboardItemLimit: 7,
        backupDirectory: { kind: "custom", basename: "합성 백업" },
      }),
      update: vi.fn().mockImplementation(async (input) => ({
        ...input,
        backupDirectory: { kind: "custom", basename: "합성 백업" },
      })),
    };
    const application = new AppSettingsApplication(repository);

    const updated = await application.updateTheme("system");
    expect(repository.update).toHaveBeenCalledWith({
      theme: "system",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    expect(updated.theme).toBe("system");
    expect(updated.backupDirectory.basename).toBe("합성 백업");
  });

  it("serializes theme read-modify-write with full Settings updates", async () => {
    let releaseLoad!: (value: typeof DEFAULT_APP_SETTINGS) => void;
    const pendingLoad = new Promise<typeof DEFAULT_APP_SETTINGS>((resolve) => {
      releaseLoad = resolve;
    });
    let stored: AppSettings = { ...DEFAULT_APP_SETTINGS };
    const repository: AppSettingsRepository = {
      load: vi.fn(() => pendingLoad),
      update: vi.fn(async (input) => {
        stored = { ...stored, ...input };
        return stored;
      }),
    };
    const application = new AppSettingsApplication(repository);

    const themeUpdate = application.updateTheme("dark");
    const preferencesUpdate = application.update({
      theme: "dark",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    expect(repository.update).not.toHaveBeenCalled();

    releaseLoad(DEFAULT_APP_SETTINGS);
    await themeUpdate;
    await preferencesUpdate;

    expect(repository.update).toHaveBeenNthCalledWith(1, {
      theme: "dark",
      recentConsultationDays: 30,
      unconsultedDays: 90,
      dashboardItemLimit: 10,
    });
    expect(repository.update).toHaveBeenNthCalledWith(2, {
      theme: "dark",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    expect(stored.recentConsultationDays).toBe(45);
  });

  it("continues the queue after a rejected operation", async () => {
    const repository: AppSettingsRepository = {
      load: vi.fn()
        .mockRejectedValueOnce(new Error("synthetic failure"))
        .mockResolvedValue(DEFAULT_APP_SETTINGS),
      update: vi.fn(async (input) => ({ ...DEFAULT_APP_SETTINGS, ...input })),
    };
    const application = new AppSettingsApplication(repository);

    await expect(application.load()).rejects.toThrow("synthetic failure");
    await expect(application.update({
      theme: "dark",
      recentConsultationDays: 30,
      unconsultedDays: 90,
      dashboardItemLimit: 10,
    })).resolves.toMatchObject({ theme: "dark" });
  });
});
