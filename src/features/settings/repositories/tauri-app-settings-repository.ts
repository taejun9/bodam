import { invoke } from "@tauri-apps/api/core";
import { z } from "zod";

import {
  parseAppSettings,
  parseAppSettingsInput,
} from "../schemas/app-settings-schema";
import type {
  AppSettings,
  AppSettingsInput,
} from "../types/app-settings";
import { AppSettingsRepositoryError } from "../types/app-settings-error";
import type { AppSettingsRepository } from "./app-settings-repository";

export type AppSettingsInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
) => Promise<T>;

const defaultInvoke: AppSettingsInvoke = <T>(
  command: string,
  args?: Record<string, unknown>,
): Promise<T> => invoke<T>(command, args);

const commandErrorSchema = z.object({ code: z.string() }).passthrough();

function commandCode(error: unknown): string {
  if (typeof error === "string") {
    try {
      return commandErrorSchema.safeParse(JSON.parse(error)).data?.code ?? "";
    } catch {
      return error;
    }
  }
  return commandErrorSchema.safeParse(error).data?.code ?? "";
}

function repositoryErrorFrom(error: unknown): AppSettingsRepositoryError {
  if (error instanceof AppSettingsRepositoryError) return error;
  const code = commandCode(error).toLocaleLowerCase("en-US");
  if (code.includes("validation") || code.includes("invalid")) {
    return new AppSettingsRepositoryError("설정 입력 내용을 확인해 주세요.");
  }
  return new AppSettingsRepositoryError();
}

export class TauriAppSettingsRepository implements AppSettingsRepository {
  constructor(private readonly invokeCommand: AppSettingsInvoke = defaultInvoke) {}

  async load(): Promise<AppSettings> {
    return this.execute(async () => parseAppSettings(
      await this.invokeCommand<unknown>("load_app_settings"),
    ));
  }

  async update(input: AppSettingsInput): Promise<AppSettings> {
    const parsed = parseAppSettingsInput(input);
    return this.execute(async () => parseAppSettings(
      await this.invokeCommand<unknown>("update_app_settings", { input: parsed }),
    ));
  }

  private async execute<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error: unknown) {
      throw repositoryErrorFrom(error);
    }
  }
}
