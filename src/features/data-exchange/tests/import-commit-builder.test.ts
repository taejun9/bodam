import { describe, expect, it } from "vitest";

import { parseImportContextSnapshot } from "../schemas/import-context-schema";
import {
  buildImportCommitRequest,
  validateImportCommitResult,
} from "../services/import-commit-builder";
import { buildImportPreview, prepareImportFile } from "../services/import-preview";
import type { ImportCommitDraft, ImportCommitResult } from "../types/import-commit";
import { DataExchangeError, DataExchangeValidationError } from "../types/data-exchange-error";
import {
  contextSnapshot,
  duplicateCandidate,
  ids,
  parsedFile,
  sourceRow,
} from "./data-exchange-test-data";

const preview = () => buildImportPreview(
  prepareImportFile(parsedFile([
    sourceRow(2, { insurer: "신규보험", policyNumber: "NEW" }),
    sourceRow(3, { insurer: "신규보험", policyNumber: "NEW" }),
    sourceRow(4, { insurer: "기존보험", policyNumber: "DB" }),
    sourceRow(5, { policyNumber: null }),
  ])),
  parseImportContextSnapshot(contextSnapshot([duplicateCandidate({
    insurer: "기존보험",
    policyNumber: "DB",
  })])),
  ids.preview,
);

const validDraft = (): ImportCommitDraft => ({
  previewId: ids.preview,
  newCustomers: [
    { clientKey: ids.clientOne, name: "  A\u030A 합성 고객  " },
    { clientKey: ids.clientUnused, name: "사용하지 않는 합성 고객" },
  ],
  rows: [
    {
      sourceRow: 4,
      decision: { action: "update", targetPolicyId: ids.policyOne },
    },
    {
      sourceRow: 3,
      decision: {
        action: "separateCreate",
        customer: { kind: "new", clientKey: ids.clientOne },
      },
    },
    {
      sourceRow: 2,
      decision: {
        action: "create",
        customer: { kind: "new", clientKey: ids.clientOne },
      },
    },
  ],
});

describe("import commit request builder", () => {
  it("builds a stable minimal request and normalizes only the new Customer definition", () => {
    const request = buildImportCommitRequest(preview(), validDraft());

    expect(request.rows.map(({ source }) => source.sourceRow)).toEqual([2, 3, 4]);
    expect(request.newCustomers).toEqual([
      { clientKey: ids.clientOne, name: "Å 합성 고객" },
    ]);
    expect(request.summary).toEqual({ totalRows: 4, invalidRows: 0, unselectedRows: 1 });
    expect(request.rows[0]?.source.cells.insurer).toBe("신규보험");
    expect(request.rows[0]?.mapped.coverageTerm).toBeNull();
  });

  it("rejects implicit duplicate creation, unknown update targets and missing customers", () => {
    const duplicateRows: Array<ImportCommitDraft["rows"][number]> = [...validDraft().rows];
    duplicateRows[1] = {
      sourceRow: 3,
      decision: {
        action: "create",
        customer: { kind: "new", clientKey: ids.clientOne },
      },
    };
    expect(() => buildImportCommitRequest(preview(), {
      ...validDraft(),
      rows: duplicateRows,
    }))
      .toThrow(DataExchangeValidationError);

    const updateRows: Array<ImportCommitDraft["rows"][number]> = [...validDraft().rows];
    updateRows[0] = {
      sourceRow: 4,
      decision: { action: "update", targetPolicyId: ids.policyTwo },
    };
    expect(() => buildImportCommitRequest(preview(), {
      ...validDraft(),
      rows: updateRows,
    }))
      .toThrow(DataExchangeValidationError);

    const customerRows: Array<ImportCommitDraft["rows"][number]> = [...validDraft().rows];
    customerRows[2] = {
      sourceRow: 2,
      decision: {
        action: "create",
        customer: { kind: "existing", customerId: ids.policyTwo },
      },
    };
    expect(() => buildImportCommitRequest(preview(), {
      ...validDraft(),
      rows: customerRows,
    }))
      .toThrow(DataExchangeValidationError);
  });

  it("rejects multiple selected rows that update the same policy", () => {
    const repeatedTargetPreview = buildImportPreview(
      prepareImportFile(parsedFile([
        sourceRow(2),
        sourceRow(3, { productName: "두 번째 합성상품" }),
      ])),
      parseImportContextSnapshot(contextSnapshot([duplicateCandidate()])),
      ids.preview,
    );
    const messages = validationMessages(() => buildImportCommitRequest(
      repeatedTargetPreview,
      {
        previewId: ids.preview,
        newCustomers: [],
        rows: [2, 3].map((sourceRowNumber) => ({
          sourceRow: sourceRowNumber,
          decision: { action: "update" as const, targetPolicyId: ids.policyOne },
        })),
      },
    ));

    expect(messages).toContain("같은 기존 계약은 한 번만 갱신할 수 있습니다.");
  });

  it("requires at least one write and the current preview id", () => {
    expect(validationMessages(() => buildImportCommitRequest(preview(), {
      previewId: ids.preview,
      newCustomers: [],
      rows: [{ sourceRow: 4, decision: { action: "skip" } }],
    }))).toContain("반영할 생성 또는 수정 행을 하나 이상 선택해 주세요.");

    expect(validationMessages(() => buildImportCommitRequest(preview(), {
      ...validDraft(),
      previewId: ids.clientUnused,
    }))).toContain("현재 미리보기와 일치하지 않습니다.");
  });

  it("accepts only a complete, ordered and count-consistent native result", () => {
    const request = buildImportCommitRequest(preview(), validDraft());
    const result: ImportCommitResult = {
      created: 2,
      updated: 1,
      skipped: 0,
      totalRows: 4,
      invalidRows: 0,
      unselectedRows: 1,
      outcomes: [
        { sourceRow: 2, outcome: "created", policyId: ids.policyTwo },
        { sourceRow: 3, outcome: "created", policyId: ids.clientUnused },
        { sourceRow: 4, outcome: "updated", policyId: ids.policyOne },
      ],
    };

    expect(validateImportCommitResult(result, request)).toBe(result);
    expect(() => validateImportCommitResult({ ...result, created: 1 }, request))
      .toThrow(DataExchangeError);
    expect(() => validateImportCommitResult({
      ...result,
      outcomes: [...result.outcomes].reverse(),
    }, request)).toThrow(DataExchangeError);
  });
});

function validationMessages(operation: () => unknown): string[] {
  try {
    operation();
    return [];
  } catch (error: unknown) {
    expect(error).toBeInstanceOf(DataExchangeValidationError);
    return (error as DataExchangeValidationError).issues.map(({ message }) => message);
  }
}
