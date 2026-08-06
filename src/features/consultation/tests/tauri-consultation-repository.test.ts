import { describe, expect, it } from "vitest";

import {
  TauriConsultationRepository,
  type ConsultationInvoke,
} from "../repositories/tauri-consultation-repository";
import type { Consultation } from "../types/consultation";
import {
  CONSULTATION_IDS,
  CUSTOMER_IDS,
  consultation,
  consultationInput,
} from "./consultation-test-data";

interface Invocation {
  readonly command: string;
  readonly args: Record<string, unknown> | undefined;
}

function invocationHarness(overrides: Record<string, unknown> = {}) {
  const calls: Invocation[] = [];
  const responses: Record<string, unknown> = {
    list_consultations: [
      consultation(CONSULTATION_IDS[1]),
      consultation(CONSULTATION_IDS[0]),
    ],
    create_consultation: consultation(CONSULTATION_IDS[0]),
    update_consultation: {
      ...consultation(CONSULTATION_IDS[0]),
      result: "합성 수정 결과",
    },
    delete_consultation: { id: CONSULTATION_IDS[0] },
    ...overrides,
  };
  const invoke: ConsultationInvoke = <T>(
    command: string,
    args?: Record<string, unknown>,
  ) => {
    calls.push({ command, args });
    return Promise.resolve(responses[command] as T);
  };
  return { calls, repository: new TauriConsultationRepository(invoke) };
}

describe("TauriConsultationRepository command contract", () => {
  it("uses exact commands, normalized payloads, and stable response order", async () => {
    const { calls, repository } = invocationHarness();
    await expect(repository.list(CUSTOMER_IDS[0])).resolves.toMatchObject([
      { id: CONSULTATION_IDS[0] },
      { id: CONSULTATION_IDS[1] },
    ]);
    await repository.create(CUSTOMER_IDS[0], {
      ...consultationInput("2026-08-06T10:02:03+09:00"),
      content: "  합성 상담 내용  ",
    });
    await repository.update(CONSULTATION_IDS[0], {
      ...consultationInput(),
      result: "  합성 수정 결과  ",
    });
    await repository.remove(CONSULTATION_IDS[0]);

    expect(calls).toEqual([
      { command: "list_consultations", args: { customerId: CUSTOMER_IDS[0] } },
      {
        command: "create_consultation",
        args: {
          customerId: CUSTOMER_IDS[0],
          input: { ...consultationInput(), content: "합성 상담 내용" },
        },
      },
      {
        command: "update_consultation",
        args: {
          id: CONSULTATION_IDS[0],
          input: { ...consultationInput(), result: "합성 수정 결과" },
        },
      },
      { command: "delete_consultation", args: { id: CONSULTATION_IDS[0] } },
    ]);
  });

  it("rejects malformed output and mismatched delete acknowledgements", async () => {
    const malformed = {
      ...consultation(CONSULTATION_IDS[0]),
      rogue: "synthetic-private-marker",
    } as Consultation;
    const { repository } = invocationHarness({
      list_consultations: [malformed],
      delete_consultation: { id: CONSULTATION_IDS[1] },
    });
    await expect(repository.list(CUSTOMER_IDS[0]))
      .rejects.toMatchObject({ code: "unexpected" });
    await expect(repository.remove(CONSULTATION_IDS[0])).rejects.toMatchObject({
      message: "상담 삭제 응답을 확인할 수 없습니다.",
    });
  });

  it.each([
    ["CONSULTATION_NOT_FOUND", "not_found"],
    ["CUSTOMER_NOT_FOUND", "customer_not_found"],
    ["VALIDATION_ERROR", "unexpected"],
  ])("maps native %s to safe %s errors", async (nativeCode, expectedCode) => {
    const invoke: ConsultationInvoke = () => Promise.reject({
      code: nativeCode,
      message: "synthetic private native detail",
    });
    const repository = new TauriConsultationRepository(invoke);
    await expect(repository.list(CUSTOMER_IDS[0]))
      .rejects.toMatchObject({ code: expectedCode });
    await expect(repository.list(CUSTOMER_IDS[0]))
      .rejects.not.toThrow("synthetic private native detail");
  });
});
