import { describe, expect, it } from "vitest";

import { parseImportContextSnapshot } from "../schemas/import-context-schema";
import {
  buildImportPreview,
  prepareImportFile,
} from "../services/import-preview";
import { DataExchangeError } from "../types/data-exchange-error";
import {
  contextSnapshot,
  duplicateCandidate,
  ids,
  parsedFile,
  sourceRow,
} from "./data-exchange-test-data";

describe("import preview service", () => {
  it("builds unique normalized keys and stable database/batch duplicate defaults", () => {
    const file = parsedFile([
      sourceRow(2, { policyNumber: " 000-POLICY " }),
      sourceRow(3, { policyNumber: "000-POLICY", productName: "합성상품 B" }),
      sourceRow(4, { policyNumber: "  " }),
      sourceRow(5, { policyNumber: "OTHER", collectionReflectedOn: "2026-02-30" }),
    ]);
    const prepared = prepareImportFile(file);

    expect(prepared.contextQuery.keys).toEqual([
      { insurer: "합성보험", policyNumber: "000-POLICY" },
    ]);

    const preview = buildImportPreview(
      prepared,
      parseImportContextSnapshot(contextSnapshot([duplicateCandidate()])),
      ids.preview,
    );

    expect(preview.customers.map(({ id }) => id)).toEqual([
      ids.customerOne,
      ids.customerTwo,
    ]);
    expect(preview.rows.map((row) => ({
      sourceRow: row.source.sourceRow,
      decision: row.defaultDecision,
      batch: row.batchDuplicateOf,
      candidates: row.duplicateCandidates.map(({ policyId }) => policyId),
    }))).toEqual([
      { sourceRow: 2, decision: "skip", batch: null, candidates: [ids.policyOne] },
      { sourceRow: 3, decision: "skip", batch: 2, candidates: [ids.policyOne] },
      { sourceRow: 4, decision: "create", batch: null, candidates: [] },
      { sourceRow: 5, decision: "invalid", batch: null, candidates: [] },
    ]);
  });

  it("does not let an invalid first row reserve the batch duplicate key", () => {
    const prepared = prepareImportFile(parsedFile([
      sourceRow(2, { collectionReflectedOn: "invalid" }),
      sourceRow(3),
      sourceRow(4),
    ]));
    const preview = buildImportPreview(
      prepared,
      parseImportContextSnapshot(contextSnapshot()),
      ids.preview,
    );

    expect(preview.rows[0]?.defaultDecision).toBe("invalid");
    expect(preview.rows[1]?.batchDuplicateOf).toBeNull();
    expect(preview.rows[2]?.batchDuplicateOf).toBe(3);
  });

  it("keeps duplicate tuple keys distinct when their values contain NUL", () => {
    const prepared = prepareImportFile(parsedFile([
      sourceRow(2, { insurer: "A", policyNumber: "B\0C" }),
      sourceRow(3, { insurer: "A\0B", policyNumber: "C" }),
    ]));

    expect(prepared.contextQuery.keys).toEqual([
      { insurer: "A", policyNumber: "B\0C" },
      { insurer: "A\0B", policyNumber: "C" },
    ]);

    const preview = buildImportPreview(
      prepared,
      parseImportContextSnapshot(contextSnapshot()),
      ids.preview,
    );
    expect(preview.rows.map((row) => ({
      decision: row.defaultDecision,
      batch: row.batchDuplicateOf,
    }))).toEqual([
      { decision: "create", batch: null },
      { decision: "create", batch: null },
    ]);
  });

  it("rejects a backend duplicate candidate that was not requested", () => {
    const prepared = prepareImportFile(parsedFile());
    const unexpected = duplicateCandidate({
      policyId: ids.policyTwo,
      insurer: "다른보험",
      policyNumber: "OTHER",
    });

    expect(() => buildImportPreview(
      prepared,
      parseImportContextSnapshot(contextSnapshot([unexpected])),
      ids.preview,
    )).toThrow(DataExchangeError);
  });
});
