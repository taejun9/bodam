import { AppSettingsApplication } from "@/features/settings/application/app-settings-application";
import { createAppSettingsRepository } from "@/features/settings/repositories/app-settings-repository-factory";

export const appSettingsApplication = new AppSettingsApplication(
  createAppSettingsRepository(),
);
