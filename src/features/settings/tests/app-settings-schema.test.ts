import { describe, expect, it } from "vitest";

import {
  parseAppSettings,
  parseAppSettingsInput,
} from "../schemas/app-settings-schema";
import {
  DEFAULT_APP_SETTINGS,
  DEFAULT_APP_SETTINGS_INPUT,
} from "../types/app-settings";
import {
  AppSettingsRepositoryError,
  AppSettingsValidationError,
} from "../types/app-settings-error";

describe("app settings schema", () => {
  it("accepts the approved defaults and inclusive numeric boundaries", () => {
    expect(parseAppSettings(DEFAULT_APP_SETTINGS)).toEqual(DEFAULT_APP_SETTINGS);
    expect(parseAppSettingsInput({
      theme: "dark",
      recentConsultationDays: 1,
      unconsultedDays: 1,
      dashboardItemLimit: 1,
    })).toEqual({
      theme: "dark",
      recentConsultationDays: 1,
      unconsultedDays: 1,
      dashboardItemLimit: 1,
    });
    expect(parseAppSettingsInput({
      theme: "system",
      recentConsultationDays: 365,
      unconsultedDays: 3_650,
      dashboardItemLimit: 10,
    })).toMatchObject({ theme: "system" });
  });

  it("rejects overlap, out-of-range values, and backup input fields", () => {
    expect(() => parseAppSettingsInput({
      ...DEFAULT_APP_SETTINGS_INPUT,
      recentConsultationDays: 91,
      unconsultedDays: 90,
    })).toThrow(AppSettingsValidationError);
    expect(() => parseAppSettingsInput({
      ...DEFAULT_APP_SETTINGS_INPUT,
      dashboardItemLimit: 11,
    })).toThrow(AppSettingsValidationError);
    expect(() => parseAppSettingsInput({
      ...DEFAULT_APP_SETTINGS_INPUT,
      backupDirectory: { kind: "custom", basename: "blocked" },
    })).toThrow(AppSettingsValidationError);
  });

  it("strictly validates pathless backup directory display metadata", () => {
    expect(parseAppSettings({
      ...DEFAULT_APP_SETTINGS_INPUT,
      backupDirectory: { kind: "custom", basename: "합성 백업" },
    }).backupDirectory).toEqual({ kind: "custom", basename: "합성 백업" });
    for (const basename of ["private/path", "..", "bad\u0000name", "bad\u0085name"]) {
      expect(() => parseAppSettings({
        ...DEFAULT_APP_SETTINGS_INPUT,
        backupDirectory: { kind: "custom", basename },
      })).toThrow(AppSettingsRepositoryError);
    }
    expect(() => parseAppSettings({
      ...DEFAULT_APP_SETTINGS,
      unknownField: true,
    })).toThrow(AppSettingsRepositoryError);
    expect(() => parseAppSettings({
      ...DEFAULT_APP_SETTINGS_INPUT,
      backupDirectory: { kind: "default", basename: "backups" },
    })).toThrow(AppSettingsRepositoryError);
    expect(() => parseAppSettings({
      ...DEFAULT_APP_SETTINGS_INPUT,
      backupDirectory: { kind: "custom", basename: null },
    })).toThrow(AppSettingsRepositoryError);
  });
});
