import { z } from "zod";

const safeText = z.string().min(1).max(300);
const basename = z.string().min(1).max(255).refine(
  (value) => value !== "." && value !== ".." &&
    !/[\\/\p{Cc}]/u.test(value),
  "파일명만 허용됩니다.",
);
const timestamp = z.string().datetime({ offset: true }).refine(
  (value) => value.endsWith("Z"),
  "UTC timestamp여야 합니다.",
);
const reason = z.enum(["daily", "exit", "manual", "pre_restore"]);

const location = z.object({
  kind: z.enum(["default", "custom"]),
  basename: basename.nullable(),
  available: z.boolean(),
}).strict().superRefine((value, context) => {
  if (value.kind === "default" && value.basename !== null) {
    context.addIssue({ code: "custom", message: "기본 위치는 이름을 노출하지 않습니다." });
  }
  if (value.kind === "custom" && value.basename === null) {
    context.addIssue({ code: "custom", message: "사용자 위치에는 폴더 이름이 필요합니다." });
  }
});

export const backupStatusSchema = z.object({
  available: z.boolean(),
  location,
  lastSuccessfulAt: timestamp.nullable(),
  // A failed retention deletion can safely leave more than the target count.
  automaticCount: z.number().int().min(0).max(0xffff_ffff),
  maxAutomaticCount: z.literal(30),
  lastFailure: safeText.nullable(),
  restoreStartup: z.object({
    outcome: z.enum(["restored", "rolled_back"]),
    message: safeText,
  }).strict().nullable(),
  exitFailurePending: z.boolean(),
}).strict();

export const backupResultSchema = z.object({
  basename,
  createdAt: timestamp,
  reason,
  retentionWarning: z.boolean(),
}).strict();

export const restorePreviewSchema = z.object({
  token: z.string().uuid(),
  basename,
  createdAt: timestamp,
  appVersion: z.string().min(1).max(100),
  schemaVersion: z.string().min(1).max(200),
  reason,
}).strict();

export const restorePreparedSchema = z.object({
  restartRequired: z.literal(true),
  safetyBackupBasename: basename,
}).strict();
