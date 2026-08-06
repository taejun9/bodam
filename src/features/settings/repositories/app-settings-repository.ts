import type {
  AppSettings,
  AppSettingsInput,
} from "../types/app-settings";

export interface AppSettingsRepository {
  load(): Promise<AppSettings>;
  update(input: AppSettingsInput): Promise<AppSettings>;
}
