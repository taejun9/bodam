// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
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

vi.mock("@/app/composition/calendar", () => ({
  calendarApplication: calendarMocks,
}));
vi.mock("@/app/composition/schedule", () => ({
  scheduleApplication: scheduleMocks,
}));
vi.mock("@/features/calendar/components/calendar-runtime", () => ({
  calendarReferenceDate: () => "2026-08-06",
  hasCalendarReferenceDateOverride: () => false,
  millisecondsUntilNextLocalMidnight: () => 60_000,
  resolvedLocalTimeZone: () => "Asia/Seoul",
}));

import CalendarPage from "../pages/CalendarPage.vue";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

describe("Calendar schedule delete focus recovery", () => {
  beforeEach(() => vi.clearAllMocks());

  afterEach(() => {
    document.body.replaceChildren();
    vi.useRealTimers();
  });

  it("focuses Calendar retry when the post-delete reload fails", async () => {
    calendarMocks.loadMonth
      .mockResolvedValueOnce(calendarUiModel())
      .mockRejectedValueOnce(new Error("private-calendar-reload-marker"));
    scheduleMocks.remove.mockResolvedValue(undefined);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/calendar", name: "calendar", component: CalendarPage },
        { path: "/customers/:customerId", component: { template: "<div />" } },
      ],
    });
    await router.push("/calendar?month=2026-08&date=2026-08-06");
    await router.isReady();
    const wrapper = mount(CalendarPage, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: { AppDialog: dialogStub },
      },
    });
    await flushPromises();

    const schedule = wrapper.get(
      `[data-event-id='schedule:${calendarUiIds.schedule}']`,
    );
    const remove = schedule.findAll("button").find((button) => button.text() === "삭제")!;
    remove.element.focus();
    await remove.trigger("click");
    const confirm = wrapper.findAll("button")
      .find((button) => button.text().includes("일정 삭제"))!;
    confirm.element.focus();
    await confirm.trigger("click");
    await flushPromises();

    const retry = wrapper.get("[data-testid='calendar-retry']");
    expect(scheduleMocks.remove).toHaveBeenCalledWith(calendarUiIds.schedule);
    expect(calendarMocks.loadMonth).toHaveBeenCalledTimes(2);
    expect(wrapper.text()).not.toContain("private-calendar-reload-marker");
    expect(document.activeElement).toBe(retry.element);

    wrapper.unmount();
  });
});
