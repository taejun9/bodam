import { z } from "zod";

import { DASHBOARD_MAX_ITEMS } from "@/features/dashboard/types/dashboard";

import type {
  AppSettings,
  AppSettingsInput,
} from "../types/app-settings";
import {
  MAX_RECENT_CONSULTATION_DAYS,
  MAX_UNCONSULTED_DAYS,
  MIN_RECENT_CONSULTATION_DAYS,
  MIN_UNCONSULTED_DAYS,
} from "../types/app-settings";
import {
  AppSettingsRepositoryError,
  AppSettingsValidationError,
} from "../types/app-settings-error";

export const ThemeModeSchema = z.enum(["light", "dark", "system"]);

const settingsInputShape = {
  theme: ThemeModeSchema,
  recentConsultationDays: z.number().int().min(
    MIN_RECENT_CONSULTATION_DAYS,
    "최근 상담 기간은 1일 이상이어야 합니다.",
  ).max(
    MAX_RECENT_CONSULTATION_DAYS,
    "최근 상담 기간은 365일 이하여야 합니다.",
  ),
  unconsultedDays: z.number().int().min(
    MIN_UNCONSULTED_DAYS,
    "미상담 기준은 1일 이상이어야 합니다.",
  ).max(
    MAX_UNCONSULTED_DAYS,
    "미상담 기준은 3,650일 이하여야 합니다.",
  ),
  dashboardItemLimit: z.number().int().min(
    1,
    "카드 표시 건수는 1건 이상이어야 합니다.",
  ).max(
    DASHBOARD_MAX_ITEMS,
    `카드 표시 건수는 ${DASHBOARD_MAX_ITEMS}건 이하여야 합니다.`,
  ),
};

function validatePeriodOrder(
  value: Pick<AppSettingsInput, "recentConsultationDays" | "unconsultedDays">,
  context: z.RefinementCtx,
): void {
  if (value.unconsultedDays < value.recentConsultationDays) {
    context.addIssue({
      code: "custom",
      path: ["unconsultedDays"],
      message: "미상담 기준은 최근 상담 기간 이상이어야 합니다.",
    });
  }
}

export const AppSettingsInputSchema: z.ZodType<AppSettingsInput> = z
  .object(settingsInputShape)
  .strict()
  .superRefine(validatePeriodOrder);

const safeBasenameSchema = z.string().min(1).max(255).refine(
  (value) => value !== "." && value !== ".." && !/[\\/\p{Cc}]/u.test(value),
  "backup directory basename is invalid",
);

const backupDirectoryDisplaySchema = z.object({
  kind: z.enum(["default", "custom"]),
  basename: safeBasenameSchema.nullable(),
}).strict().superRefine((value, context) => {
  if (value.kind === "default" && value.basename !== null) {
    context.addIssue({
      code: "custom",
      path: ["basename"],
      message: "default backup directory must not expose a basename",
    });
  }
  if (value.kind === "custom" && value.basename === null) {
    context.addIssue({
      code: "custom",
      path: ["basename"],
      message: "custom backup directory requires a safe basename",
    });
  }
});

export const AppSettingsSchema: z.ZodType<AppSettings> = z.object({
  ...settingsInputShape,
  backupDirectory: backupDirectoryDisplaySchema,
}).strict().superRefine(validatePeriodOrder);

export function parseAppSettingsInput(value: unknown): AppSettingsInput {
  const result = AppSettingsInputSchema.safeParse(value);
  if (!result.success) {
    throw new AppSettingsValidationError(result.error.issues.map((issue) => ({
      field: issue.path.join(".") || "input",
      message: issue.message,
    })));
  }
  return result.data;
}

export function parseAppSettings(value: unknown): AppSettings {
  const result = AppSettingsSchema.safeParse(value);
  if (!result.success) {
    throw new AppSettingsRepositoryError(
      "설정 응답을 확인할 수 없습니다.",
      "storage_corrupt",
    );
  }
  return result.data;
}

export function toAppSettingsInput(settings: AppSettings): AppSettingsInput {
  return parseAppSettingsInput({
    theme: settings.theme,
    recentConsultationDays: settings.recentConsultationDays,
    unconsultedDays: settings.unconsultedDays,
    dashboardItemLimit: settings.dashboardItemLimit,
  });
}
