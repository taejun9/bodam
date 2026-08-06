// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoverageCategory } from "@/features/coverage/types/coverage";
import { CoverageBenchmarkValidationError } from "@/features/coverage-benchmark/types/coverage-benchmark-error";
import type { CoverageBenchmark } from "@/features/coverage-benchmark/types/coverage-benchmark";

const benchmarkMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  assessCustomer: vi.fn(),
  categoryBenchmarkUsageCount: vi.fn(),
}));
const coverageMocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
}));

vi.mock("@/app/composition/coverage-benchmark", () => ({
  coverageBenchmarkApplication: benchmarkMocks,
}));
vi.mock("@/app/composition/coverage", () => ({
  coverageApplication: coverageMocks,
}));

import CoverageBenchmarkSection from "../components/CoverageBenchmarkSection.vue";

const timestamp = "2026-08-06T01:02:03.000Z";
const categoryIds = [
  "73000000-0000-4000-8000-000000000001",
  "73000000-0000-4000-8000-000000000002",
] as const;
const benchmarkIds = [
  "74000000-0000-4000-8000-000000000001",
  "74000000-0000-4000-8000-000000000002",
] as const;
const categories: CoverageCategory[] = categoryIds.map((id) => ({
  id,
  name: "합성 보장",
  createdAt: timestamp,
  updatedAt: timestamp,
}));

function benchmark(id: string, categoryId: string, gender = "합성 성별"): CoverageBenchmark {
  return {
    id,
    categoryId,
    gender,
    minAgeYears: 20,
    maxAgeYears: 39,
    adequateMinWon: 50_000_000n,
    excessiveMinWon: 100_000_000n,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const first = benchmark(benchmarkIds[0], categoryIds[0]);
const second = benchmark(benchmarkIds[1], categoryIds[1]);
const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

function mountSection() {
  return mount(CoverageBenchmarkSection, {
    attachTo: document.body,
    global: { stubs: { AppDialog: dialogStub } },
  });
}

async function fillValidForm(wrapper: ReturnType<typeof mountSection>) {
  await wrapper.get("select[name='categoryId']").setValue(categoryIds[0]);
  await wrapper.get("input[name='gender']").setValue(" 합성 성별 ");
  await wrapper.get("input[name='minAgeYears']").setValue("20");
  await wrapper.get("input[name='maxAgeYears']").setValue("39");
  await wrapper.get("input[name='adequateMinWon']").setValue("50000000");
  await wrapper.get("input[name='excessiveMinWon']").setValue("100000000");
}

describe("CoverageBenchmark settings UI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    benchmarkMocks.list.mockResolvedValue([first, second]);
    benchmarkMocks.create.mockResolvedValue(first);
    benchmarkMocks.update.mockResolvedValue(first);
    benchmarkMocks.remove.mockResolvedValue(undefined);
    coverageMocks.listCategories.mockResolvedValue(categories);
  });

  it("exposes loading and empty states without inventing recommended defaults", async () => {
    let settle!: (value: CoverageBenchmark[]) => void;
    benchmarkMocks.list.mockReturnValueOnce(new Promise((resolve) => {
      settle = resolve;
    }));
    const wrapper = mountSection();
    await nextTick();
    expect(wrapper.get("[data-testid='benchmark-section']").attributes("aria-busy"))
      .toBe("true");
    expect(wrapper.text()).toContain("보장 비교 기준을 불러오는 중입니다");

    settle([]);
    await flushPromises();
    expect(wrapper.get("[data-testid='benchmark-section']").attributes("aria-busy"))
      .toBe("false");
    expect(wrapper.text()).toContain("등록된 보장 비교 기준이 없습니다");
    expect(wrapper.text()).toContain("권고 기준은 자동으로 제공하지 않습니다");
    wrapper.unmount();
  });

  it("shows the disclaimer, formula, duplicate identity, bigint money, and ID-bound actions", async () => {
    const wrapper = mountSection();
    await flushPromises();

    expect(wrapper.get("[data-testid='benchmark-disclaimer']").text())
      .toContain("공식 보험 권고나 적합성 판단이 아닙니다");
    expect(wrapper.text()).toContain("가입금액 < 적정 하한");
    const rows = wrapper.findAll("[data-testid='benchmark-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.attributes("data-benchmark-id")).toBe(benchmarkIds[0]);
    expect(rows[0]?.text()).toContain(`카테고리 ID ${categoryIds[0]}`);
    expect(rows[0]?.text()).toContain("50,000,000원");
    expect(rows[0]?.get("[data-testid='edit-benchmark']").attributes("aria-label"))
      .toContain(`기준 ID ${benchmarkIds[0]}`);
    expect(wrapper.findAll("[data-testid='benchmark-card']")).toHaveLength(2);
    wrapper.unmount();
  });

  it("submits exact integer values and restores focus to the surviving create action", async () => {
    benchmarkMocks.list
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([first]);
    const wrapper = mountSection();
    await flushPromises();
    await wrapper.get("[data-testid='create-benchmark']").trigger("click");
    await fillValidForm(wrapper);
    await wrapper.get("[data-testid='benchmark-form']").trigger("submit");
    await flushPromises();
    await nextTick();

    expect(benchmarkMocks.create).toHaveBeenCalledWith({
      categoryId: categoryIds[0],
      gender: "합성 성별",
      minAgeYears: 20,
      maxAgeYears: 39,
      adequateMinWon: 50_000_000n,
      excessiveMinWon: 100_000_000n,
    });
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='create-benchmark']").element,
    );
    wrapper.unmount();
  });

  it("focuses the first local or application validation error", async () => {
    const wrapper = mountSection();
    await flushPromises();
    await wrapper.get("[data-testid='create-benchmark']").trigger("click");
    await wrapper.get("[data-testid='benchmark-form']").trigger("submit");
    await nextTick();
    expect(document.activeElement).toBe(wrapper.get("select[name='categoryId']").element);

    await fillValidForm(wrapper);
    benchmarkMocks.create.mockRejectedValueOnce(new CoverageBenchmarkValidationError([
      { field: "maxAgeYears", message: "최대 만나이를 확인해 주세요." },
    ]));
    await wrapper.get("[data-testid='benchmark-form']").trigger("submit");
    await flushPromises();
    await nextTick();
    expect(document.activeElement).toBe(wrapper.get("input[name='maxAgeYears']").element);
    wrapper.unmount();
  });

  it("autofocuses the first field and restores the invoker after Escape", async () => {
    const wrapper = mount(CoverageBenchmarkSection, { attachTo: document.body });
    await flushPromises();
    const create = wrapper.get("[data-testid='create-benchmark']");
    (create.element as HTMLElement).focus();
    await create.trigger("click");
    await flushPromises();

    const dialog = document.querySelector<HTMLDialogElement>("dialog[open]");
    const category = dialog?.querySelector<HTMLSelectElement>("select[name='categoryId']");
    expect(document.activeElement).toBe(category);
    dialog?.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    await nextTick();
    expect(document.querySelector("dialog[open]")).toBeNull();
    expect(document.activeElement).toBe(create.element);
    wrapper.unmount();
  });

  it("updates and soft-deletes the selected stable ID", async () => {
    benchmarkMocks.list
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([first, second])
      .mockResolvedValueOnce([first]);
    const wrapper = mountSection();
    await flushPromises();
    const secondRow = wrapper.findAll("[data-testid='benchmark-row']")[1];
    await secondRow?.get("[data-testid='edit-benchmark']").trigger("click");
    await wrapper.get("input[name='gender']").setValue("수정 성별");
    await wrapper.get("[data-testid='benchmark-form']").trigger("submit");
    await flushPromises();
    expect(benchmarkMocks.update).toHaveBeenCalledWith(
      benchmarkIds[1],
      expect.objectContaining({ gender: "수정 성별" }),
    );

    const refreshedSecond = wrapper.findAll("[data-testid='benchmark-row']")[1];
    await refreshedSecond?.get("[data-testid='delete-benchmark']").trigger("click");
    const deleteIdentity = wrapper.get("[data-testid='benchmark-delete-identity']");
    expect(deleteIdentity.text()).toContain(`카테고리 ID ${categoryIds[1]}`);
    expect(deleteIdentity.text()).toContain(`기준 ID ${benchmarkIds[1]}`);
    await wrapper.get("[data-testid='confirm-delete-benchmark']").trigger("click");
    await flushPromises();
    expect(benchmarkMocks.remove).toHaveBeenCalledWith(benchmarkIds[1]);
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='create-benchmark']").element,
    );
    wrapper.unmount();
  });

  it("shows a privacy-safe retry state without retaining raw errors", async () => {
    benchmarkMocks.list.mockRejectedValueOnce(new Error("private-benchmark-marker-007"));
    const wrapper = mountSection();
    await flushPromises();
    expect(wrapper.get("[role='alert']").text()).toContain("작업을 완료하지 못했습니다");
    expect(wrapper.text()).not.toContain("private-benchmark-marker-007");
    expect(wrapper.text()).not.toContain("합성 성별");
    wrapper.unmount();
  });
});
