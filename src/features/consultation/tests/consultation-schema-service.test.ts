import { describe, expect, it } from "vitest";

import {
  MAX_CONSULTATION_CONTENT_CHARS,
  MAX_CONSULTATION_RESULT_CHARS,
  parseConsultation,
  parseConsultationId,
  parseConsultationInput,
} from "../schemas/consultation-schema";
import {
  currentLocalDateTimeValue,
  formatConsultedAtLocal,
  localDateTimeToUtcTimestamp,
  utcTimestampToLocalDateTime,
} from "../services/consultation-datetime";
import { sortConsultationsLatestFirst } from "../services/consultation-order";
import {
  ConsultationRepositoryError,
  ConsultationValidationError,
  consultationSafeMessage,
} from "../types/consultation-error";
import {
  CONSULTATION_IDS,
  CUSTOMER_IDS,
  TEST_TIMESTAMP,
  consultation,
  consultationInput,
} from "./consultation-test-data";

describe("consultation schemas", () => {
  it("normalizes offset timestamps, optional text, and date-only values", () => {
    expect(parseConsultationInput({
      consultedAt: "2026-08-06T10:30:15+09:00",
      content: "  합성 내용\n둘째 줄  ",
      nextContactOn: " 2026-08-20 ",
      result: "   ",
    })).toEqual({
      consultedAt: "2026-08-06T01:30:15.000Z",
      content: "합성 내용\n둘째 줄",
      nextContactOn: "2026-08-20",
      result: null,
    });
  });

  it("enforces Unicode scalar limits and strict timestamp/date payloads", () => {
    expect(parseConsultationInput({
      ...consultationInput(),
      content: "😀".repeat(MAX_CONSULTATION_CONTENT_CHARS),
      result: "가".repeat(MAX_CONSULTATION_RESULT_CHARS),
    }).content).toHaveLength(MAX_CONSULTATION_CONTENT_CHARS * 2);

    for (const input of [
      { ...consultationInput(), consultedAt: "2026-08-06T10:30" },
      { ...consultationInput(), nextContactOn: "2026-02-29" },
      { ...consultationInput(), content: "가".repeat(MAX_CONSULTATION_CONTENT_CHARS + 1) },
      { ...consultationInput(), result: "가".repeat(MAX_CONSULTATION_RESULT_CHARS + 1) },
      { ...consultationInput(), extra: "synthetic" },
      { consultedAt: TEST_TIMESTAMP },
    ]) {
      expect(() => parseConsultationInput(input)).toThrow(ConsultationValidationError);
    }
  });

  it("accepts canonical ids and strictly parses normalized repository output", () => {
    expect(parseConsultationId(CONSULTATION_IDS[0])).toBe(CONSULTATION_IDS[0]);
    expect(() => parseConsultationId("A1000000-0000-4000-8000-000000000001"))
      .toThrow(ConsultationValidationError);
    expect(parseConsultation(consultation(CONSULTATION_IDS[0])))
      .toEqual(consultation(CONSULTATION_IDS[0]));
    expect(() => parseConsultation({
      ...consultation(CONSULTATION_IDS[0]),
      consultedAt: "2026-08-06T10:02:03+09:00",
    })).toThrow(ConsultationRepositoryError);
    expect(() => parseConsultation({
      ...consultation(CONSULTATION_IDS[0]),
      updatedAt: "2026-08-06T10:02:03+09:00",
    })).toThrow(ConsultationRepositoryError);
    expect(() => parseConsultation({
      ...consultation(CONSULTATION_IDS[0]),
      deletedAt: null,
    })).toThrow(ConsultationRepositoryError);
  });

  it("redacts unexpected failures from safe user messages", () => {
    expect(consultationSafeMessage(new Error("synthetic private marker"))).toBe(
      "작업을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.",
    );
  });
});

describe("consultation time and order services", () => {
  it("round-trips a real local datetime through normalized UTC milliseconds", () => {
    const local = "2026-08-06T10:11:12.345";
    const utc = localDateTimeToUtcTimestamp(local);
    expect(utc).toMatch(/Z$/);
    expect(utcTimestampToLocalDateTime(utc)).toBe(local);
    expect(currentLocalDateTimeValue(new Date(utc))).toBe(local.slice(0, 16));
    expect(formatConsultedAtLocal(utc)).toBe("2026. 08. 06. 10:11");
    expect(() => localDateTimeToUtcTimestamp("2026-02-29T10:00"))
      .toThrow(ConsultationValidationError);
  });

  it("sorts newest first and uses ascending ids for duplicate instants", () => {
    const sorted = sortConsultationsLatestFirst([
      consultation(CONSULTATION_IDS[1]),
      consultation(CONSULTATION_IDS[2], CUSTOMER_IDS[0], "2026-08-07T00:00:00.000Z"),
      consultation(CONSULTATION_IDS[0]),
    ]);
    expect(sorted.map(({ id }) => id)).toEqual([
      CONSULTATION_IDS[2],
      CONSULTATION_IDS[0],
      CONSULTATION_IDS[1],
    ]);
  });
});
