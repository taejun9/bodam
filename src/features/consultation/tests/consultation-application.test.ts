import { describe, expect, it, vi } from "vitest";

import { ConsultationApplication } from "../application/consultation-application";
import type { ConsultationRepository } from "../repositories/consultation-repository";
import { ConsultationRepositoryError } from "../types/consultation-error";
import {
  CONSULTATION_IDS,
  CUSTOMER_IDS,
  consultation,
  consultationInput,
  customer,
} from "./consultation-test-data";

function repositorySpies(): ConsultationRepository {
  return {
    list: vi.fn().mockResolvedValue([
      consultation(CONSULTATION_IDS[1]),
      consultation(CONSULTATION_IDS[2], CUSTOMER_IDS[0], "2026-08-07T00:00:00.000Z"),
      consultation(CONSULTATION_IDS[0]),
    ]),
    create: vi.fn((customerId, input) => Promise.resolve({
      ...consultation(CONSULTATION_IDS[0], customerId),
      ...input,
    })),
    update: vi.fn((id, input) => Promise.resolve({
      ...consultation(id),
      ...input,
    })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ConsultationApplication", () => {
  it("checks the active Customer, normalizes writes, and returns stable order", async () => {
    const repository = repositorySpies();
    const customers = { list: vi.fn().mockResolvedValue([customer()]) };
    const application = new ConsultationApplication(repository, customers);

    await expect(application.list(CUSTOMER_IDS[0])).resolves.toMatchObject([
      { id: CONSULTATION_IDS[2] },
      { id: CONSULTATION_IDS[0] },
      { id: CONSULTATION_IDS[1] },
    ]);
    await application.create(CUSTOMER_IDS[0], {
      ...consultationInput("2026-08-06T10:02:03+09:00"),
      content: "  합성 내용  ",
    });
    await application.update(CONSULTATION_IDS[0], {
      ...consultationInput(),
      result: "  합성 수정  ",
    });
    await application.remove(CONSULTATION_IDS[0]);

    expect(repository.create).toHaveBeenCalledWith(CUSTOMER_IDS[0], {
      ...consultationInput(),
      content: "합성 내용",
    });
    expect(repository.update).toHaveBeenCalledWith(CONSULTATION_IDS[0], {
      ...consultationInput(),
      result: "합성 수정",
    });
    expect(repository.remove).toHaveBeenCalledWith(CONSULTATION_IDS[0]);
  });

  it("blocks inactive Customer list and create before repository access", async () => {
    const repository = repositorySpies();
    const application = new ConsultationApplication(repository, {
      list: () => Promise.resolve([]),
    });

    await expect(application.list(CUSTOMER_IDS[0]))
      .rejects.toMatchObject({ code: "customer_not_found" });
    await expect(application.create(CUSTOMER_IDS[0], consultationInput()))
      .rejects.toMatchObject({ code: "customer_not_found" });
    expect(repository.list).not.toHaveBeenCalled();
    expect(repository.create).not.toHaveBeenCalled();
  });

  it("rejects malformed repository output without exposing its values", async () => {
    const repository = repositorySpies();
    vi.mocked(repository.create).mockResolvedValue({
      ...consultation(CONSULTATION_IDS[0]),
      content: "가".repeat(4_001),
    });
    const application = new ConsultationApplication(repository, {
      list: () => Promise.resolve([customer()]),
    });
    await expect(application.create(CUSTOMER_IDS[0], consultationInput())).rejects.toEqual(
      new ConsultationRepositoryError("상담 데이터 응답을 확인할 수 없습니다."),
    );
  });
});
