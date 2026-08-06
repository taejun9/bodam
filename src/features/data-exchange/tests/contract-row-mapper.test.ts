import { describe, expect, it } from "vitest";

import { mapContractSourceRow } from "../services/contract-row-mapper";
import {
  canonicalPremium,
  isCalendarDate,
  isYearMonth,
} from "../services/contract-normalization";
import { sourceRow } from "./data-exchange-test-data";

describe("contract row mapping", () => {
  it("preserves all raw text while mapping trim, NFC, dates and bigint money", () => {
    const row = sourceRow(2, {
      insurer: "  A\u030A 보험  ",
      productName: "  합성 상품  ",
      policyNumber: "  000-AB  ",
      status: "   ",
      paymentPremium: "0001200",
      collectionMethod: "",
    });

    const result = mapContractSourceRow(row);

    expect(result.issues).toEqual([]);
    expect(result.mapped).toEqual({
      insurer: "Å 보험",
      productName: "합성 상품",
      joinedOn: "2026-01-31",
      status: null,
      monthlyPremiumWon: "1200",
      maturesOn: "2036-01-31",
      paymentTerm: "10년",
      coverageTerm: null,
      disclosurePlan: null,
      renewable: false,
      isIncluded: true,
    });
    expect(result.duplicateKey).toEqual({ insurer: "Å 보험", policyNumber: "000-AB" });
    expect(result.source.cells.insurer).toBe("  A\u030A 보험  ");
    expect(result.source.cells.paymentPremium).toBe("0001200");
    expect(result.source.cells.collectionMethod).toBe("");
  });

  it("returns stable field issues for every approved typed mapping rule", () => {
    const tooLong = "가".repeat(201);
    const result = mapContractSourceRow(sourceRow(2, {
      insurer: " ",
      productName: tooLong,
      collectionReflectedOn: "2025-02-29",
      contractedOn: "0000-01-01",
      status: tooLong,
      finalPaymentMonth: "202613",
      paymentSequence: "１２",
      paymentPremium: "9223372036854775808",
      coverageStartsOn: "2026-04-31",
      coverageEndsOn: "2026-02-30",
      paymentTerm: tooLong,
    }));

    expect(result.mapped).toBeNull();
    expect(result.issues.map(({ field, code }) => [field, code])).toEqual([
      ["collectionReflectedOn", "INVALID_DATE"],
      ["insurer", "REQUIRED"],
      ["productName", "TEXT_TOO_LONG"],
      ["contractedOn", "INVALID_DATE"],
      ["status", "TEXT_TOO_LONG"],
      ["finalPaymentMonth", "INVALID_YEAR_MONTH"],
      ["paymentSequence", "INVALID_DIGITS"],
      ["paymentPremium", "INVALID_PREMIUM"],
      ["coverageStartsOn", "INVALID_DATE"],
      ["coverageEndsOn", "INVALID_DATE"],
      ["paymentTerm", "TEXT_TOO_LONG"],
    ]);
  });

  it("keeps a parser cell issue without adding a misleading required issue", () => {
    const row = sourceRow(2, { insurer: null });
    const result = mapContractSourceRow(row, [{
      sourceRow: 2,
      field: "insurer",
      code: "FORMULA_CELL",
      message: "수식 cell은 가져올 수 없습니다.",
    }]);

    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]?.code).toBe("FORMULA_CELL");
    expect(result.mapped).toBeNull();
    expect(result.duplicateKey).toBeNull();
  });

  it("uses proleptic Gregorian dates and canonical signed-64-bit premiums", () => {
    expect(isCalendarDate("0001-01-01")).toBe(true);
    expect(isCalendarDate("2000-02-29")).toBe(true);
    expect(isCalendarDate("1900-02-29")).toBe(false);
    expect(isCalendarDate("0000-12-31")).toBe(false);
    expect(isYearMonth("999912")).toBe(true);
    expect(isYearMonth("202600")).toBe(false);
    expect(canonicalPremium("0000")).toBe("0");
    expect(canonicalPremium("9223372036854775807")).toBe("9223372036854775807");
    expect(canonicalPremium("9223372036854775808")).toBeNull();
  });
});
