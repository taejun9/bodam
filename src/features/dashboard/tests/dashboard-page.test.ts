// @vitest-environment happy-dom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardReadModel } from "@/features/dashboard/types/dashboard";

import { dashboardModel } from "./dashboard-page-test-data";

const applicationMocks = vi.hoisted(() => ({ load: vi.fn() }));
const runtimeMocks = vi.hoisted(() => ({
  referenceDate: vi.fn(() => "2026-08-06"),
  referenceInstant: vi.fn(() => "2026-08-06T03:00:00.000Z"),
  millisecondsUntilMidnight: vi.fn(() => 60_000),
}));

vi.mock("@/app/composition/dashboard", () => ({
  dashboardApplication: applicationMocks,
}));
vi.mock("@/features/dashboard/components/dashboard-runtime", () => ({
  resolvedLocalTimeZone: () => "Asia/Seoul",
  dashboardReferenceDate: runtimeMocks.referenceDate,
  dashboardReferenceInstant: runtimeMocks.referenceInstant,
  hasDashboardReferenceDateOverride: () => false,
  millisecondsUntilNextLocalMidnight: runtimeMocks.millisecondsUntilMidnight,
}));

import DashboardPage from "@/features/dashboard/pages/DashboardPage.vue";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
  reject(reason: unknown): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

async function mountPage(): Promise<VueWrapper> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/dashboard", component: DashboardPage },
      { path: "/customers/:customerId", component: { template: "<div />" } },
      { path: "/families", component: { template: "<div />" } },
    ],
  });
  await router.push("/dashboard");
  await router.isReady();
  return mount(DashboardPage, {
    attachTo: document.body,
    global: { plugins: [router] },
  });
}

function setVisibility(value: "hidden" | "visible"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("DashboardPage", () => {
  const mounted: VueWrapper[] = [];

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    runtimeMocks.millisecondsUntilMidnight.mockReturnValue(60_000);
    setVisibility("visible");
  });

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("renders all eight semantic list cards and canonical values", async () => {
    applicationMocks.load.mockResolvedValue(dashboardModel());
    const wrapper = await mountPage();
    mounted.push(wrapper);
    await flushPromises();

    const metrics = wrapper.findAll("[data-dashboard-metric]");
      expect(metrics.map((card) => card.attributes("data-dashboard-metric"))).toEqual([
        "today-contact",
        "insurance-age",
        "maturity",
        "premium-top",
        "family-premium",
        "coverage-insufficient",
        "recent-consultation",
        "unconsulted",
      ]);
    expect(metrics.every((card) => card.element.tagName === "SECTION")).toBe(true);
    expect(wrapper.findAll(".dashboard-card-list")).toHaveLength(8);
    expect(wrapper.findAll("[data-testid='dashboard-item']")).toHaveLength(8);
    expect(wrapper.findAll("[data-testid='dashboard-reason']")).toHaveLength(8);
    expect(wrapper.get("[data-testid='dashboard-reference-date']").attributes("datetime"))
      .toBe("2026-08-06");

    const age = wrapper.get("[data-dashboard-metric='insurance-age'] [data-testid='dashboard-item']");
    expect(age.attributes("data-insurance-age")).toBe("27");
    expect(age.attributes("data-bucket")).toBe("0-30");
    expect(age.get("time").attributes("datetime")).toBe("2026-08-29");
    const maturity = wrapper.get("[data-dashboard-metric='maturity'] [data-testid='dashboard-item']");
    expect(maturity.attributes("data-item-id")).toBe(
      "83000000-0000-4000-8000-000000000001",
    );
    expect(maturity.attributes("data-bucket")).toBe("31-60");
    const premium = wrapper.get("[data-dashboard-metric='premium-top']");
    expect(premium.attributes("data-total-count")).toBe("12");
    expect(premium.get("[data-amount-won]").attributes("data-amount-won"))
      .toBe("9007199254740993");
    expect(premium.text()).toContain("전체 12건 중 앞선 1건");
    expect(wrapper.get("[data-family-id] a").attributes("href")).toBe("/families");
    expect(wrapper.get("[data-category-ids]").attributes("data-category-ids"))
      .toBe("85000000-0000-4000-8000-000000000001");
    expect(applicationMocks.load).toHaveBeenCalledWith({
      referenceDate: "2026-08-06",
      referenceInstant: "2026-08-06T03:00:00.000Z",
      timeZone: "Asia/Seoul",
    });
    expect(wrapper.text()).toContain("오늘 포함 최근 30일");
    expect(wrapper.text()).toContain("90일 이상 상담하지 않았거나");
  });

  it("keeps all eight cards visible when every card is empty", async () => {
    const noItems = { totalCount: 0, isTruncated: false, items: [] as const };
    applicationMocks.load.mockResolvedValue({
      ...dashboardModel(),
      todayContact: noItems,
      insuranceAge: noItems,
      maturity: noItems,
      premiumTop: noItems,
      familyPremium: noItems,
      coverageInsufficient: noItems,
      recentConsultation: noItems,
      unconsulted: noItems,
    });
    const wrapper = await mountPage();
    mounted.push(wrapper);
    await flushPromises();

    expect(wrapper.findAll("[data-dashboard-metric]")).toHaveLength(8);
    expect(wrapper.findAll(".dashboard-card-empty")).toHaveLength(8);
    expect(wrapper.findAll(".dashboard-card-list")).toHaveLength(0);
    expect(wrapper.findAll("[data-testid='dashboard-item']")).toHaveLength(0);
    expect(wrapper.text()).toContain("오늘 연락할 고객이 없습니다.");
    expect(wrapper.text()).toContain("최근 미상담 관리 고객이 없습니다.");
  });

  it("shows a safe error, retries in place, then moves focus to the content heading", async () => {
    const first = deferred<DashboardReadModel>();
    const second = deferred<DashboardReadModel>();
    applicationMocks.load
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const wrapper = await mountPage();
    mounted.push(wrapper);
    expect(wrapper.text()).toContain("오늘의 업무를 계산하고 있습니다");
    expect(wrapper.get("[data-testid='dashboard-page']").attributes("aria-busy")).toBe("true");

    first.reject(new Error("private-dashboard-marker"));
    await flushPromises();
    const alert = wrapper.get("[role='alert']");
    expect(alert.text()).toContain("대시보드를 불러오지 못했습니다. 다시 시도해 주세요.");
    expect(wrapper.text()).not.toContain("private-dashboard-marker");
    expect(wrapper.find("[data-dashboard-metric]").exists()).toBe(false);

    const retry = wrapper.get("[data-testid='dashboard-retry']");
    (retry.element as HTMLElement).focus();
    await retry.trigger("click");
    expect(retry.attributes("disabled")).toBeDefined();
    expect(retry.text()).toContain("다시 불러오는 중");
    second.resolve(dashboardModel());
    await flushPromises();
    expect(wrapper.findAll("[data-dashboard-metric]")).toHaveLength(8);
    expect(document.activeElement?.id).toBe("dashboard-content-title");
  });

  it("refreshes on focus, resume, and local midnight", async () => {
    vi.useFakeTimers();
    runtimeMocks.millisecondsUntilMidnight.mockReturnValue(100);
    applicationMocks.load.mockResolvedValue(dashboardModel());
    const wrapper = await mountPage();
    mounted.push(wrapper);
    await flushPromises();
    expect(applicationMocks.load).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(applicationMocks.load).toHaveBeenCalledTimes(2);
    setVisibility("hidden");
    expect(applicationMocks.load).toHaveBeenCalledTimes(2);
    setVisibility("visible");
    await flushPromises();
    expect(applicationMocks.load).toHaveBeenCalledTimes(3);

    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(applicationMocks.load).toHaveBeenCalledTimes(4);
  });

  it("does not let an older overlapping response replace the newest model", async () => {
    const oldRequest = deferred<DashboardReadModel>();
    const newRequest = deferred<DashboardReadModel>();
    applicationMocks.load
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const wrapper = await mountPage();
    mounted.push(wrapper);
    window.dispatchEvent(new Event("focus"));

    newRequest.resolve(dashboardModel("NEW"));
    await flushPromises();
    expect(wrapper.text()).toContain("합성 연락 고객 NEW");
    oldRequest.resolve(dashboardModel("OLD"));
    await flushPromises();
    expect(wrapper.text()).toContain("합성 연락 고객 NEW");
    expect(wrapper.text()).not.toContain("합성 연락 고객 OLD");
  });
});
