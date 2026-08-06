// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Consultation } from "../types/consultation";

const applicationMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/app/composition/consultation", () => ({
  consultationApplication: applicationMocks,
}));

import CustomerConsultationSection from "../components/CustomerConsultationSection.vue";

const customerA = "82000000-0000-4000-8000-000000000001";
const customerB = "82000000-0000-4000-8000-000000000002";
const consultationA = "81000000-0000-4000-8000-000000000001";
const consultationDuplicate = "81000000-0000-4000-8000-000000000002";
const consultationB = "81000000-0000-4000-8000-000000000003";
const consultedAt = "2026-08-06T01:02:03.000Z";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

function record(id: string, customerId: string, content: string): Consultation {
  return {
    id,
    customerId,
    consultedAt,
    content,
    nextContactOn: "2026-08-20",
    result: "합성 후속 확인",
    createdAt: consultedAt,
    updatedAt: consultedAt,
  };
}

const first = record(consultationA, customerA, "합성 상담 기록 A");
const duplicate = record(
  consultationDuplicate,
  customerA,
  "합성 상담 기록 같은 시각",
);
const secondCustomer = record(consultationB, customerB, "합성 상담 기록 B");

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((settle) => {
    resolve = settle;
  });
  return { promise, resolve };
}

function mountSection(customerId = customerA) {
  return mount(CustomerConsultationSection, {
    props: { customerId },
    attachTo: document.body,
    global: { stubs: { AppDialog: dialogStub } },
  });
}

describe("CustomerConsultationSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationMocks.list.mockResolvedValue([first, duplicate]);
    applicationMocks.create.mockResolvedValue(first);
    applicationMocks.update.mockResolvedValue(first);
    applicationMocks.remove.mockResolvedValue(undefined);
  });

  it("exposes loading state, UTC/date-only values, and ID-bound duplicate actions", async () => {
    const pending = deferred<Consultation[]>();
    applicationMocks.list.mockReturnValueOnce(pending.promise);
    const wrapper = mountSection();
    await nextTick();

    const section = wrapper.get("[data-testid='consultation-section']");
    expect(section.attributes("aria-busy")).toBe("true");
    expect(wrapper.text()).toContain("상담 기록을 불러오는 중입니다");

    pending.resolve([first, duplicate]);
    await flushPromises();
    expect(section.attributes("aria-busy")).toBe("false");
    const rows = wrapper.findAll("[data-testid='consultation-row']");
    expect(rows).toHaveLength(4);
    expect(rows.filter((row) =>
      row.attributes("data-consultation-id") === consultationA)).toHaveLength(2);
    expect(rows[0]?.get("[data-testid='consulted-at']").attributes("datetime"))
      .toBe(consultedAt);
    expect(rows[0]?.get("[data-testid='next-contact-on']").attributes("datetime"))
      .toBe("2026-08-20");
    expect(rows[0]?.get("[data-testid='edit-consultation']").attributes("aria-label"))
      .toContain(consultationA);
    wrapper.unmount();
  });

  it("clears the previous customer immediately and ignores stale responses", async () => {
    const customerBLoad = deferred<Consultation[]>();
    applicationMocks.list
      .mockResolvedValueOnce([first])
      .mockReturnValueOnce(customerBLoad.promise);
    const wrapper = mountSection();
    await flushPromises();
    expect(wrapper.text()).toContain("합성 상담 기록 A");

    await wrapper.setProps({ customerId: customerB });
    expect(wrapper.text()).not.toContain("합성 상담 기록 A");
    expect(wrapper.get("[data-testid='consultation-section']").attributes("aria-busy"))
      .toBe("true");
    customerBLoad.resolve([secondCustomer]);
    await flushPromises();
    expect(wrapper.text()).toContain("합성 상담 기록 B");

    const staleA = deferred<Consultation[]>();
    const latestB = deferred<Consultation[]>();
    applicationMocks.list
      .mockReturnValueOnce(staleA.promise)
      .mockReturnValueOnce(latestB.promise);
    void wrapper.setProps({ customerId: customerA });
    await nextTick();
    void wrapper.setProps({ customerId: customerB });
    await nextTick();
    latestB.resolve([secondCustomer]);
    await flushPromises();
    staleA.resolve([first]);
    await flushPromises();
    expect(wrapper.text()).toContain("합성 상담 기록 B");
    expect(wrapper.text()).not.toContain("합성 상담 기록 A");
    wrapper.unmount();
  });

  it("updates the exact duplicate ID and restores focus after reload", async () => {
    const wrapper = mountSection();
    await flushPromises();
    const target = wrapper.findAll("[data-testid='consultation-row']")
      .find((row) =>
        row.attributes("data-consultation-id") === consultationDuplicate);
    await target?.get("[data-testid='edit-consultation']").trigger("click");
    await wrapper.get("input[name='result']").setValue("합성 일정 조정");
    await wrapper.get("form.consultation-form").trigger("submit");
    await flushPromises();
    await nextTick();

    expect(applicationMocks.update).toHaveBeenCalledWith(
      consultationDuplicate,
      expect.objectContaining({ result: "합성 일정 조정" }),
    );
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='create-consultation']").element,
    );
    wrapper.unmount();
  });

  it("soft-deletes the selected ID and focuses the surviving create action", async () => {
    applicationMocks.list
      .mockResolvedValueOnce([first])
      .mockResolvedValueOnce([]);
    const wrapper = mountSection();
    await flushPromises();
    await wrapper.findAll("[data-testid='delete-consultation']")[0]?.trigger("click");
    await wrapper.get("[data-testid='confirm-delete-consultation']").trigger("click");
    await flushPromises();
    await nextTick();

    expect(applicationMocks.remove).toHaveBeenCalledWith(consultationA);
    expect(wrapper.text()).toContain("등록된 상담 기록이 없습니다");
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='create-consultation']").element,
    );
    wrapper.unmount();
  });

  it("shows a safe retry state without retaining consultation content", async () => {
    applicationMocks.list.mockRejectedValueOnce(new Error("private-rejected-marker-006"));
    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.get("[role='alert']").text()).toContain("작업을 완료하지 못했습니다");
    expect(wrapper.text()).not.toContain("private-rejected-marker-006");
    expect(wrapper.text()).not.toContain("합성 상담 기록 A");
    wrapper.unmount();
  });
});
