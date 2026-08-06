// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CoverageCategory } from "@/features/coverage/types/coverage";
import type {
  CoverageAssessment,
  CoverageBenchmark,
} from "@/features/coverage-benchmark/types/coverage-benchmark";
import type { Customer } from "@/features/customer/types/customer";

const coverageMocks = vi.hoisted(() => ({
  listCategories: vi.fn(),
  list: vi.fn(),
  categoryUsageCount: vi.fn(),
  updateCategory: vi.fn(),
  removeCategory: vi.fn(),
}));
const benchmarkMocks = vi.hoisted(() => ({
  list: vi.fn(),
  assessCustomer: vi.fn(),
  categoryBenchmarkUsageCount: vi.fn(),
}));

vi.mock("@/app/composition/coverage", () => ({ coverageApplication: coverageMocks }));
vi.mock("@/app/composition/coverage-benchmark", () => ({
  coverageBenchmarkApplication: benchmarkMocks,
}));

import CustomerCoverageSection from "@/features/coverage/components/CustomerCoverageSection.vue";

const timestamp = "2026-08-06T01:02:03.000Z";
const customer: Customer = {
  id: "75000000-0000-4000-8000-000000000001",
  name: "합성 판정 고객",
  birthDate: "1996-08-06",
  gender: "합성 성별",
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: timestamp,
  updatedAt: timestamp,
};
const categoryIds = [
  "76000000-0000-4000-8000-000000000001",
  "76000000-0000-4000-8000-000000000002",
  "76000000-0000-4000-8000-000000000003",
  "76000000-0000-4000-8000-000000000004",
] as const;
const categories: CoverageCategory[] = categoryIds.map((id, index) => ({
  id,
  name: index === 3
    ? "합성초장문카테고리이름공백없이모바일폭에서도전체내용을그대로표시"
    : `합성 카테고리 ${index + 1}`,
  createdAt: timestamp,
  updatedAt: timestamp,
}));

function benchmark(categoryId: string): CoverageBenchmark {
  return {
    id: categoryId.replace("76000000", "77000000"),
    categoryId,
    gender: "합성 성별",
    minAgeYears: 20,
    maxAgeYears: 39,
    adequateMinWon: 50n,
    excessiveMinWon: 100n,
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

const benchmarks = categoryIds.slice(0, 3).map(benchmark);
const assessments: CoverageAssessment[] = [
  {
    categoryId: categoryIds[0],
    categoryName: categories[0]!.name,
    amountWon: 0n,
    coverageCount: 0,
    status: "insufficient",
    ageYears: 30,
    benchmark: benchmarks[0]!,
  },
  {
    categoryId: categoryIds[1],
    categoryName: categories[1]!.name,
    amountWon: 50n,
    coverageCount: 1,
    status: "adequate",
    ageYears: 30,
    benchmark: benchmarks[1]!,
  },
  {
    categoryId: categoryIds[2],
    categoryName: categories[2]!.name,
    amountWon: 100n,
    coverageCount: 1,
    status: "excessive",
    ageYears: 30,
    benchmark: benchmarks[2]!,
  },
  {
    categoryId: categoryIds[3],
    categoryName: categories[3]!.name,
    amountWon: 25n,
    coverageCount: 1,
    status: "unconfigured",
    ageYears: 30,
    benchmark: null,
  },
];

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

async function testRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/settings", component: { template: "<div />" } },
    ],
  });
  await router.push("/");
  return router;
}

async function mountSection() {
  return mount(CustomerCoverageSection, {
    props: { customer, policies: [] },
    global: { plugins: [await testRouter()], stubs: { AppDialog: dialogStub } },
  });
}

describe("CustomerCoverageSection benchmark integration", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    coverageMocks.listCategories.mockResolvedValue(categories);
    coverageMocks.list.mockResolvedValue([]);
    coverageMocks.categoryUsageCount.mockReturnValue(0);
    benchmarkMocks.list.mockResolvedValue(benchmarks);
    benchmarkMocks.assessCustomer.mockReturnValue(assessments);
    benchmarkMocks.categoryBenchmarkUsageCount.mockImplementation(
      (items: CoverageBenchmark[], categoryId: string) =>
        items.filter((item) => item.categoryId === categoryId).length,
    );
  });

  it("renders four explicit statuses, trace, settings link, and matched zero coverage", async () => {
    const wrapper = await mountSection();
    await flushPromises();

    expect(wrapper.text()).toContain("공식 보험 권고나 적합성 판단이 아닙니다");
    expect(wrapper.get("[data-testid='coverage-settings-link']").attributes("href"))
      .toBe("/settings");
    const rows = wrapper.findAll("[data-testid='coverage-assessment-row']");
    expect(rows).toHaveLength(4);
    const statuses = rows.map((row) =>
      row.get("[data-testid='coverage-classification']")
        .attributes("data-classification"));
    expect(statuses).toEqual(["insufficient", "adequate", "excessive", "unconfigured"]);
    expect(rows[0]?.text()).toContain("보장 0건");
    expect(rows[0]?.text()).toContain("0원");
    expect(rows[0]?.get("[data-testid='coverage-assessment-trace']").text())
      .toContain("적정 50원 이상 · 과다 100원 이상");
    expect(rows[3]?.text()).toContain("정확히 일치하는 활성 기준 없음");
    expect(rows[3]?.text())
      .toContain("합성초장문카테고리이름공백없이모바일폭에서도전체내용을그대로표시");
    expect(benchmarkMocks.assessCustomer).toHaveBeenCalledWith(
      customer,
      categories,
      [],
      [],
      benchmarks,
      expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
    );
  });

  it("shows active benchmark usage before category soft deletion", async () => {
    const wrapper = await mountSection();
    await flushPromises();
    await wrapper.get("[data-testid='manage-categories']").trigger("click");
    const categoryActions = wrapper.findAll("[data-category-action='delete']");
    await categoryActions[0]?.trigger("click");
    expect(wrapper.text()).toContain("활성 비교 기준 1건");
    expect(wrapper.text()).toContain("목록·합계·판정에서 숨겨집니다");
  });

  it("does not expose a raw failure or stale assessment rows", async () => {
    benchmarkMocks.list.mockRejectedValueOnce(new Error("private-assessment-marker-007"));
    const wrapper = await mountSection();
    await flushPromises();
    expect(wrapper.get("[role='alert']").text()).toContain("작업을 완료하지 못했습니다");
    expect(wrapper.text()).not.toContain("private-assessment-marker-007");
    expect(wrapper.findAll("[data-testid='coverage-assessment-row']")).toHaveLength(0);
  });
});
