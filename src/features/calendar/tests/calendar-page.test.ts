// @vitest-environment happy-dom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import {
  createMemoryHistory,
  createRouter,
  type Router,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CalendarMonthReadModel } from "../types/calendar";
import {
  calendarUiEvents,
  calendarUiIds,
  calendarUiModel,
} from "./calendar-ui-test-data";

const calendarMocks = vi.hoisted(() => ({ loadMonth: vi.fn() }));
const scheduleMocks = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  setCompleted: vi.fn(),
  remove: vi.fn(),
}));
const runtimeMocks = vi.hoisted(() => ({
  referenceDate: vi.fn(() => "2026-08-06"),
  millisecondsUntilMidnight: vi.fn(() => 60_000),
}));

vi.mock("@/app/composition/calendar", () => ({
  calendarApplication: calendarMocks,
}));
vi.mock("@/app/composition/schedule", () => ({
  scheduleApplication: scheduleMocks,
}));
vi.mock("@/features/calendar/components/calendar-runtime", () => ({
  calendarReferenceDate: runtimeMocks.referenceDate,
  hasCalendarReferenceDateOverride: () => false,
  millisecondsUntilNextLocalMidnight: runtimeMocks.millisecondsUntilMidnight,
  resolvedLocalTimeZone: () => "Asia/Seoul",
}));

import CalendarPage from "../pages/CalendarPage.vue";

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

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

async function mountPage(path: string): Promise<{ wrapper: VueWrapper; router: Router }> {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/calendar", name: "calendar", component: CalendarPage },
      { path: "/customers/:customerId", component: { template: "<div />" } },
    ],
  });
  await router.push(path);
  await router.isReady();
  const wrapper = mount(CalendarPage, {
    attachTo: document.body,
    global: { plugins: [router], stubs: { AppDialog: dialogStub } },
  });
  return { wrapper, router };
}

function setVisibility(value: "hidden" | "visible"): void {
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value,
  });
  document.dispatchEvent(new Event("visibilitychange"));
}

describe("CalendarPage", () => {
  const mounted: VueWrapper[] = [];

  beforeEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
    runtimeMocks.referenceDate.mockReturnValue("2026-08-06");
    runtimeMocks.millisecondsUntilMidnight.mockReturnValue(60_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    for (const wrapper of mounted.splice(0)) wrapper.unmount();
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("canonicalizes the route and renders five stable event kinds with source links", async () => {
    calendarMocks.loadMonth.mockResolvedValue(calendarUiModel());
    const { wrapper, router } = await mountPage("/calendar?month=bad&date=2026-08-31");
    mounted.push(wrapper);
    await flushPromises();

    expect(router.currentRoute.value.query).toEqual({
      month: "2026-08",
      date: "2026-08-06",
    });
    expect(calendarMocks.loadMonth).toHaveBeenLastCalledWith({
      month: "2026-08",
      timeZone: "Asia/Seoul",
    });
    expect(wrapper.get("[data-calendar-date='2026-08-06']").classes())
      .toContain("is-today");

    const agendaEvents = wrapper.findAll(".calendar-agenda-item");
    expect(agendaEvents.map((item) => item.attributes("data-event-kind"))).toEqual([
      "next-contact",
      "insurance-age",
      "policy-maturity",
      "consultation",
      "schedule",
    ]);
    expect(agendaEvents.map((item) => item.attributes("data-event-id"))).toEqual(
      calendarUiEvents.map((event) => event.id),
    );
    expect(agendaEvents[0]?.get("a").attributes("href"))
      .toBe(`/customers/${calendarUiIds.customer}`);
    const completed = agendaEvents.at(-1)!;
    expect(completed.classes()).toContain("is-completed");
    expect(completed.text()).toContain("완료 되돌리기");
    expect(completed.get(".calendar-customer-link").attributes("href"))
      .toBe(`/customers/${calendarUiIds.customer}`);
  });

  it("canonicalizes unsupported years and keeps keyboard navigation inside view limits", async () => {
    calendarMocks.loadMonth.mockImplementation(({ month }: { month: string }) =>
      Promise.resolve(calendarUiModel(month, []))
    );
    const { wrapper, router } = await mountPage(
      "/calendar?month=9999-12&date=9999-12-31",
    );
    mounted.push(wrapper);
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      month: "2026-08",
      date: "2026-08-06",
    });

    await router.push("/calendar?month=0001-01&date=0001-01-01");
    await flushPromises();
    expect(wrapper.get("button[aria-label='이전 달']").attributes("disabled"))
      .toBeDefined();
    await wrapper.get("[data-calendar-date='0001-01-01'] button")
      .trigger("keydown", { key: "ArrowLeft" });
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      month: "0001-01",
      date: "0001-01-01",
    });

    await router.push("/calendar?month=9998-12&date=9998-12-31");
    await flushPromises();
    expect(wrapper.get("button[aria-label='다음 달']").attributes("disabled"))
      .toBeDefined();
    await wrapper.get("[data-calendar-date='9998-12-31'] button")
      .trigger("keydown", { key: "ArrowRight" });
    await flushPromises();
    expect(router.currentRoute.value.query).toEqual({
      month: "9998-12",
      date: "9998-12-31",
    });
  });

  it("shows a safe load failure, retries in place, and focuses the page heading", async () => {
    const first = deferred<CalendarMonthReadModel>();
    const retry = deferred<CalendarMonthReadModel>();
    calendarMocks.loadMonth
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(retry.promise);
    const { wrapper } = await mountPage(
      "/calendar?month=2026-08&date=2026-08-06",
    );
    mounted.push(wrapper);

    expect(wrapper.text()).toContain("월간 달력을 불러오는 중입니다");
    expect(wrapper.get("[data-testid='calendar-page']").attributes("aria-busy"))
      .toBe("true");
    first.reject(new Error("private-calendar-load-marker"));
    await flushPromises();
    expect(wrapper.get("[role='alert']").text()).toContain(
      "캘린더를 불러오지 못했습니다. 다시 시도해 주세요.",
    );
    expect(wrapper.text()).not.toContain("private-calendar-load-marker");

    const button = wrapper.get("[data-testid='calendar-retry']");
    (button.element as HTMLElement).focus();
    await button.trigger("click");
    expect(button.attributes("disabled")).toBeDefined();
    retry.resolve(calendarUiModel());
    await flushPromises();
    expect(wrapper.findAll(".calendar-agenda-item")).toHaveLength(5);
    expect(document.activeElement?.id).toBe("calendar-content-title");
  });

  it("focuses the stable agenda create action after a schedule soft delete reload", async () => {
    calendarMocks.loadMonth
      .mockResolvedValueOnce(calendarUiModel())
      .mockResolvedValueOnce(
        calendarUiModel("2026-08", calendarUiEvents.filter((event) => event.kind !== "schedule")),
      );
    scheduleMocks.remove.mockResolvedValue(undefined);
    const { wrapper } = await mountPage("/calendar?month=2026-08&date=2026-08-06");
    mounted.push(wrapper);
    await flushPromises();

    const schedule = wrapper.get(
      `[data-event-id='schedule:${calendarUiIds.schedule}']`,
    );
    const remove = schedule.findAll("button").find((button) => button.text() === "삭제")!;
    remove.element.focus();
    await remove.trigger("click");
    const confirm = wrapper.findAll("button")
      .find((button) => button.text().includes("일정 삭제"))!;
    await confirm.trigger("click");
    await flushPromises();

    expect(scheduleMocks.remove).toHaveBeenCalledWith(calendarUiIds.schedule);
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(2);
    expect(document.activeElement).toBe(
      wrapper.get("[data-testid='agenda-create-schedule']").element,
    );
  });

  it("reloads on focus, resume, and local midnight", async () => {
    vi.useFakeTimers();
    runtimeMocks.millisecondsUntilMidnight.mockReturnValue(100);
    calendarMocks.loadMonth.mockResolvedValue(calendarUiModel());
    const { wrapper } = await mountPage(
      "/calendar?month=2026-08&date=2026-08-06",
    );
    mounted.push(wrapper);
    await flushPromises();
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(1);

    window.dispatchEvent(new Event("focus"));
    await flushPromises();
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(2);
    setVisibility("hidden");
    setVisibility("visible");
    await flushPromises();
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(3);
    await vi.advanceTimersByTimeAsync(100);
    await flushPromises();
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(4);
  });

  it("ignores a stale overlapping response", async () => {
    const oldRequest = deferred<CalendarMonthReadModel>();
    const newRequest = deferred<CalendarMonthReadModel>();
    calendarMocks.loadMonth
      .mockReturnValueOnce(oldRequest.promise)
      .mockReturnValueOnce(newRequest.promise);
    const { wrapper } = await mountPage(
      "/calendar?month=2026-08&date=2026-08-06",
    );
    mounted.push(wrapper);
    window.dispatchEvent(new Event("focus"));

    newRequest.resolve(calendarUiModel("2026-08", calendarUiEvents.map((item) => ({
      ...item,
      title: `${item.title} NEW`,
    }))));
    await flushPromises();
    expect(wrapper.text()).toContain("합성 달력 고객 다음 연락 NEW");
    oldRequest.resolve(calendarUiModel("2026-08", calendarUiEvents.map((item) => ({
      ...item,
      title: `${item.title} OLD`,
    }))));
    await flushPromises();
    expect(wrapper.text()).not.toContain("합성 달력 고객 다음 연락 OLD");
    expect(wrapper.text()).toContain("합성 달력 고객 다음 연락 NEW");
  });
});
