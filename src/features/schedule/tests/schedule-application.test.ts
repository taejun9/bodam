import { describe, expect, it, vi } from "vitest";

import { ScheduleApplication } from "../application/schedule-application";
import type { ScheduleRepository } from "../repositories/schedule-repository";
import { ScheduleRepositoryError } from "../types/schedule-error";
import {
  SCHEDULE_CUSTOMER_IDS,
  SCHEDULE_IDS,
  schedule,
  scheduleCustomer,
  scheduleInput,
} from "./schedule-test-data";

function repositorySpies(): ScheduleRepository {
  return {
    list: vi.fn().mockResolvedValue([
      schedule(SCHEDULE_IDS[2], { title: "나", scheduledTime: "09:00" }),
      schedule(SCHEDULE_IDS[1], {
        title: "숨김",
        customerId: SCHEDULE_CUSTOMER_IDS[1],
      }),
      schedule(SCHEDULE_IDS[0], { title: "가", scheduledTime: null }),
    ]),
    create: vi.fn((input) => Promise.resolve({
      ...schedule(SCHEDULE_IDS[0]),
      ...input,
    })),
    update: vi.fn((id, input) => Promise.resolve({
      ...schedule(id),
      ...input,
    })),
    setCompleted: vi.fn((id, isCompleted) => Promise.resolve({
      ...schedule(id),
      isCompleted,
    })),
    remove: vi.fn().mockResolvedValue(undefined),
  };
}

describe("ScheduleApplication", () => {
  it("normalizes the query, hides inactive parents, and returns stable order", async () => {
    const repository = repositorySpies();
    const customers = { list: vi.fn().mockResolvedValue([scheduleCustomer()]) };
    const application = new ScheduleApplication(repository, customers);

    await expect(application.list({
      startOn: " 2026-08-01 ",
      endBefore: " 2026-09-01 ",
    })).resolves.toMatchObject([
      { id: SCHEDULE_IDS[0] },
      { id: SCHEDULE_IDS[2] },
    ]);
    expect(repository.list).toHaveBeenCalledWith({
      startOn: "2026-08-01",
      endBefore: "2026-09-01",
    });
  });

  it("normalizes writes and checks only linked target Customers", async () => {
    const repository = repositorySpies();
    const customers = { list: vi.fn().mockResolvedValue([scheduleCustomer()]) };
    const application = new ScheduleApplication(repository, customers);

    await application.create(scheduleInput({
      title: "  합성 생성  ",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }));
    await application.update(SCHEDULE_IDS[0], scheduleInput({
      memo: "  합성 수정  ",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }));
    await application.create(scheduleInput({ customerId: null }));

    expect(repository.create).toHaveBeenNthCalledWith(1, scheduleInput({
      title: "합성 생성",
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }));
    expect(repository.update).toHaveBeenCalledWith(
      SCHEDULE_IDS[0],
      scheduleInput({ memo: "합성 수정", customerId: SCHEDULE_CUSTOMER_IDS[0] }),
    );
    expect(customers.list).toHaveBeenCalledTimes(2);
  });

  it("blocks inactive linked writes before repository access", async () => {
    const repository = repositorySpies();
    const application = new ScheduleApplication(repository, {
      list: () => Promise.resolve([]),
    });

    await expect(application.create(scheduleInput({
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }))).rejects.toMatchObject({ code: "customer_not_found" });
    await expect(application.update(SCHEDULE_IDS[0], scheduleInput({
      customerId: SCHEDULE_CUSTOMER_IDS[0],
    }))).rejects.toMatchObject({ code: "customer_not_found" });
    expect(repository.create).not.toHaveBeenCalled();
    expect(repository.update).not.toHaveBeenCalled();
  });

  it("delegates completion and soft delete with validated identifiers", async () => {
    const repository = repositorySpies();
    const application = new ScheduleApplication(repository, {
      list: () => Promise.resolve([]),
    });
    await expect(application.setCompleted(SCHEDULE_IDS[0], true))
      .resolves.toMatchObject({ isCompleted: true });
    await application.remove(SCHEDULE_IDS[0]);
    expect(repository.setCompleted).toHaveBeenCalledWith(SCHEDULE_IDS[0], true);
    expect(repository.remove).toHaveBeenCalledWith(SCHEDULE_IDS[0]);
  });

  it("rejects malformed repository output without exposing values", async () => {
    const repository = repositorySpies();
    vi.mocked(repository.create).mockResolvedValue({
      ...schedule(SCHEDULE_IDS[0]),
      title: "가".repeat(201),
    });
    const application = new ScheduleApplication(repository, {
      list: () => Promise.resolve([]),
    });
    await expect(application.create(scheduleInput())).rejects.toEqual(
      new ScheduleRepositoryError("일정 데이터 응답을 확인할 수 없습니다."),
    );
  });
});
