import { describe, expect, it, vi } from "vitest";

import { createContractExportPagePort } from "../pages/contract-export-page-adapter";
import { createDataExchangePagePort } from "../pages/data-exchange-page-adapter";
import { buildImportPreview, prepareImportFile } from "../services/import-preview";
import type { ImportCommitResult } from "../types/import-commit";
import {
  contextSnapshot,
  duplicateCandidate,
  ids,
  parsedFile,
} from "./data-exchange-test-data";

const committed: ImportCommitResult = {
  totalRows: 1,
  invalidRows: 0,
  unselectedRows: 0,
  created: 1,
  updated: 0,
  skipped: 0,
  outcomes: [{ sourceRow: 2, outcome: "created", policyId: ids.policyTwo }],
};

describe("data exchange page adapter", () => {
  it("preserves export ready, cancel, and stale operation states", async () => {
    const summary = {
      exportableCount: 2,
      missingSourceCount: 1,
      conflictCount: 1,
      csvAllowed: true,
    };
    const application = {
      loadSummary: vi.fn().mockResolvedValue({ status: "ready", summary }),
      save: vi.fn()
        .mockResolvedValueOnce({ status: "cancelled" })
        .mockResolvedValueOnce({ status: "stale" }),
      clear: vi.fn(),
    };
    const port = createContractExportPagePort(application);

    await expect(port.loadSummary()).resolves.toEqual({ status: "ready", summary });
    await expect(port.save("xlsx")).resolves.toEqual({ status: "cancelled" });
    await expect(port.save("csv")).resolves.toEqual({ status: "stale" });
    port.clear?.();
    expect(application.clear).toHaveBeenCalledOnce();
  });

  it("maps the core preview without losing source text or exposing customer ids in labels", async () => {
    const corePreview = buildImportPreview(
      prepareImportFile(parsedFile()),
      contextSnapshot([duplicateCandidate()]),
      ids.preview,
    );
    const application = {
      chooseFile: vi.fn().mockResolvedValue({ status: "ready", preview: corePreview }),
      commit: vi.fn().mockResolvedValue({ status: "completed", result: committed }),
      clear: vi.fn(),
    };
    const port = createDataExchangePagePort(application);

    const preview = await port.selectFile();

    expect(preview).not.toBeNull();
    expect(preview?.fileName).toBe("synthetic-contracts.xlsx");
    expect(preview?.rows[0]?.source.paymentPremium).toBe("001200");
    expect(preview?.rows[0]?.mapped?.monthlyPremiumWon).toBe("1200");
    expect(preview?.rows[0]?.defaultDecision).toBe("skip");
    expect(preview?.rows[0]?.duplicateCandidates[0]).toMatchObject({
      policyId: ids.policyOne,
      customerName: "가 합성",
    });
  });

  it("translates UI decisions to the strict application draft and result counts", async () => {
    const corePreview = buildImportPreview(
      prepareImportFile(parsedFile()),
      contextSnapshot([duplicateCandidate()]),
      ids.preview,
    );
    const application = {
      chooseFile: vi.fn().mockResolvedValue({ status: "ready", preview: corePreview }),
      commit: vi.fn().mockResolvedValue({ status: "completed", result: committed }),
      clear: vi.fn(),
    };
    const port = createDataExchangePagePort(application);
    const preview = await port.selectFile();
    const row = preview?.rows[0];
    if (!preview || !row?.mapped) throw new Error("synthetic preview unavailable");

    const result = await port.commitImport({
      previewId: preview.previewId,
      fileName: preview.fileName,
      format: preview.format,
      newCustomers: [{ clientKey: ids.clientOne, name: "합성 신규 고객" }],
      rows: [{
        sourceRow: row.sourceRow,
        source: row.source,
        mapped: row.mapped,
        selected: true,
        customer: { kind: "new", clientKey: ids.clientOne },
        duplicateAction: "separate-create",
        duplicateTargetPolicyId: null,
        duplicateSnapshotPolicyIds: [ids.policyOne],
      }],
    });

    expect(application.commit).toHaveBeenCalledWith({
      previewId: ids.preview,
      newCustomers: [{ clientKey: ids.clientOne, name: "합성 신규 고객" }],
      rows: [{
        sourceRow: 2,
        decision: {
          action: "separateCreate",
          customer: { kind: "new", clientKey: ids.clientOne },
        },
      }],
    });
    expect(result).toMatchObject({
      createdCount: 1,
      updatedCount: 0,
      invalidCount: 0,
    });
  });
});
