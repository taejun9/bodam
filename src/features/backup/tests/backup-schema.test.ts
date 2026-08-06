import { describe, expect, it } from "vitest";

import {
  backupResultSchema,
  backupStatusSchema,
  restorePreviewSchema,
} from "../schemas/backup-schema";

const status = () => ({
  available: true,
  location: { kind: "default", basename: null, available: true },
  lastSuccessfulAt: "2026-08-07T03:00:00.000Z",
  automaticCount: 30,
  maxAutomaticCount: 30,
    lastFailure: null,
    restoreStartup: null,
    exitFailurePending: false,
  });

describe("backup IPC schemas", () => {
  it("accepts the exact pathless status and result contracts", () => {
    expect(backupStatusSchema.parse(status()).location.kind).toBe("default");
    expect(backupStatusSchema.parse({ ...status(), automaticCount: 31 }).automaticCount).toBe(31);
    expect(backupStatusSchema.parse({
      ...status(),
      exitFailurePending: true,
    }).exitFailurePending).toBe(true);
    expect(backupResultSchema.parse({
      basename: "BODAM-backup-20260807.bodam-backup",
      createdAt: "2026-08-07T03:00:00.000Z",
      reason: "manual",
      retentionWarning: false,
    }).reason).toBe("manual");
  });

  it("rejects full paths, inconsistent location labels, and unknown fields", () => {
    expect(() => backupStatusSchema.parse({
      ...status(),
      location: { kind: "custom", basename: "/Users/private/backups", available: true },
    })).toThrow();
    expect(() => backupStatusSchema.parse({
      ...status(),
      location: { kind: "default", basename: "backups", available: true },
    })).toThrow();
    expect(() => backupStatusSchema.parse({ ...status(), path: "/private" })).toThrow();
    expect(() => backupStatusSchema.parse({
      ...status(),
      location: { kind: "custom", basename: "backup\u007f", available: true },
    })).toThrow();
  });

  it("bounds restore metadata without accepting source values", () => {
    const preview = restorePreviewSchema.parse({
      token: "12000000-0000-4000-8000-000000000001",
      basename: "synthetic.bodam-backup",
      createdAt: "2026-08-07T03:00:00.000Z",
      appVersion: "0.1.0",
      schemaVersion: "20260806080000_add_app_settings",
      reason: "daily",
    });
    expect(preview.basename).toBe("synthetic.bodam-backup");
  });
});
