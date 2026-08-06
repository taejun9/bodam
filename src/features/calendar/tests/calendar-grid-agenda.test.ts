// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it } from "vitest";

import CalendarDayAgenda from "../components/CalendarDayAgenda.vue";
import CalendarMonthGrid from "../components/CalendarMonthGrid.vue";
import {
  calendarDays,
  calendarUiEvents,
  calendarUiIds,
  calendarUiSchedule,
} from "./calendar-ui-test-data";

async function testRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/customers/:customerId", component: { template: "<div />" } },
    ],
  });
  await router.push("/");
  await router.isReady();
  return router;
}

describe("calendar grid and selected-day agenda", () => {
  afterEach(() => document.body.replaceChildren());

  it("fills complete weeks with inactive blanks", async () => {
    const wrapper = mount(CalendarMonthGrid, {
      props: {
        days: calendarDays("2026-08"),
        selectedDate: "2026-08-06",
        currentDate: "2026-08-06",
      },
      global: { plugins: [await testRouter()] },
    });

    const rows = wrapper.findAll(".calendar-grid > [role='row']");
    const cells = wrapper.findAll(".calendar-week > .calendar-day");
    expect(rows).toHaveLength(7);
    expect(rows[0]?.findAll("[role='columnheader']")).toHaveLength(7);
    expect(rows.slice(1).every((row) => row.findAll("[role='gridcell']").length === 7))
      .toBe(true);
    expect(cells).toHaveLength(42);
    expect(cells.filter((cell) => cell.classes("is-blank"))).toHaveLength(11);
    expect(cells[6]?.attributes("data-calendar-date")).toBe("2026-08-01");
    expect(cells[36]?.attributes("data-calendar-date")).toBe("2026-08-31");
    expect(cells.slice(37).every((cell) => cell.attributes("aria-disabled") === "true"))
      .toBe(true);
    const selected = wrapper.get("[data-calendar-date='2026-08-06']");
    expect(selected.attributes("aria-selected")).toBe("true");
    expect(selected.get("button").attributes("aria-selected")).toBeUndefined();
    expect(selected.get("button").attributes("aria-current")).toBe("date");
    expect(wrapper.findAll(".calendar-date-button").filter(
      (button) => button.attributes("tabindex") === "0",
    )).toHaveLength(1);
    expect(wrapper.findAll(".calendar-event-chip, .calendar-more-events").every(
      (action) => action.attributes("tabindex") === "-1",
    )).toBe(true);
    wrapper.unmount();
  });

  it("always renders six complete weeks for a short month", async () => {
    const wrapper = mount(CalendarMonthGrid, {
      props: {
        days: calendarDays("2026-02"),
        selectedDate: "2026-02-01",
        currentDate: "2026-08-06",
      },
      global: { plugins: [await testRouter()] },
    });

    expect(wrapper.findAll(".calendar-week")).toHaveLength(6);
    expect(wrapper.findAll(".calendar-week > .calendar-day")).toHaveLength(42);
    wrapper.unmount();
  });

  it("maps arrow, week-edge, and page keys to date navigation and restores focus", async () => {
    const wrapper = mount(CalendarMonthGrid, {
      attachTo: document.body,
      props: {
        days: calendarDays("2026-08"),
        selectedDate: "2026-08-06",
        currentDate: "2026-08-06",
      },
      global: { plugins: [await testRouter()] },
    });
    const selected = wrapper.get("[data-calendar-date='2026-08-06'] button");

    await selected.trigger("keydown", { key: "ArrowLeft" });
    await selected.trigger("keydown", { key: "ArrowRight" });
    await selected.trigger("keydown", { key: "ArrowUp" });
    await selected.trigger("keydown", { key: "ArrowDown" });
    await selected.trigger("keydown", { key: "Home" });
    await selected.trigger("keydown", { key: "End" });
    await selected.trigger("keydown", { key: "PageUp" });
    await selected.trigger("keydown", { key: "PageDown" });

    expect(wrapper.emitted("navigateDay")?.map((entry) => entry[0])).toEqual([
      -1,
      1,
      -7,
      7,
      -4,
      2,
    ]);
    expect(wrapper.emitted("changeMonth")?.map((entry) => entry[0])).toEqual([-1, 1]);

    await wrapper.setProps({ selectedDate: "2026-08-07" });
    await nextTick();
    expect(document.activeElement).toBe(
      wrapper.get("[data-calendar-date='2026-08-07'] button").element,
    );
    wrapper.unmount();
  });

  it("keeps keyboard focus intent until a cross-month target has rendered", async () => {
    const wrapper = mount(CalendarMonthGrid, {
      attachTo: document.body,
      props: {
        days: calendarDays("2026-08"),
        selectedDate: "2026-08-31",
        currentDate: "2026-08-06",
      },
      global: { plugins: [await testRouter()] },
    });
    const selected = wrapper.get("[data-calendar-date='2026-08-31'] button");
    (selected.element as HTMLElement).focus();
    await selected.trigger("keydown", { key: "ArrowRight" });
    await wrapper.setProps({ selectedDate: "2026-09-01" });
    await nextTick();
    expect(document.activeElement).toBe(selected.element);

    await wrapper.setProps({ days: calendarDays("2026-09") });
    await nextTick();
    expect(document.activeElement).toBe(
      wrapper.get("[data-calendar-date='2026-09-01'] button").element,
    );
    wrapper.unmount();
  });

  it("keeps a completed schedule visible and exposes its edit, completion, and customer actions", async () => {
    const day = calendarDays("2026-08", calendarUiEvents)
      .find((candidate) => candidate.date === "2026-08-06")!;
    const wrapper = mount(CalendarDayAgenda, {
      props: { day, schedules: [calendarUiSchedule] },
      global: { plugins: [await testRouter()] },
    });
    const schedule = wrapper.get(`[data-event-id='schedule:${calendarUiIds.schedule}']`);

    expect(schedule.classes()).toContain("is-completed");
    expect(schedule.text()).toContain(calendarUiSchedule.memo);
    expect(schedule.get(".calendar-customer-link").attributes("href"))
      .toBe(`/customers/${calendarUiIds.customer}`);
    await schedule.get(".calendar-schedule-title").trigger("click");
    const action = (label: string) => schedule.findAll("button")
      .find((button) => button.text() === label)!;
    await action("완료 되돌리기").trigger("click");
    await action("삭제").trigger("click");

    expect(wrapper.emitted("edit")?.[0]?.[0]).toEqual(calendarUiSchedule);
    expect(wrapper.emitted("complete")?.[0]).toEqual([calendarUiSchedule, false]);
    expect(wrapper.emitted("remove")?.[0]?.[0]).toEqual(calendarUiSchedule);
    wrapper.unmount();
  });
});
