import type { AppSettingsRepository } from "../repositories/app-settings-repository";
import {
  parseAppSettings,
  parseAppSettingsInput,
  toAppSettingsInput,
} from "../schemas/app-settings-schema";
import type {
  AppSettings,
  AppSettingsInput,
} from "../types/app-settings";

export class AppSettingsApplication {
  private mutationTail: Promise<void> = Promise.resolve();

  constructor(private readonly repository: AppSettingsRepository) {}

  load(): Promise<AppSettings> {
    return this.enqueue(() => this.loadUnlocked());
  }

  update(input: AppSettingsInput): Promise<AppSettings> {
    return this.enqueue(() => this.updateUnlocked(input));
  }

  updateTheme(theme: AppSettingsInput["theme"]): Promise<AppSettings> {
    return this.enqueue(async () => {
      const current = await this.loadUnlocked();
      return this.updateUnlocked({ ...toAppSettingsInput(current), theme });
    });
  }

  private loadUnlocked = async (): Promise<AppSettings> =>
    parseAppSettings(await this.repository.load());

  private updateUnlocked = async (input: AppSettingsInput): Promise<AppSettings> => {
    const parsedInput = parseAppSettingsInput(input);
    return parseAppSettings(await this.repository.update(parsedInput));
  };

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.mutationTail.then(operation, operation);
    this.mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }
}
