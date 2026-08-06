// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it } from "vitest";

import ScheduleDeleteDialog from "../components/ScheduleDeleteDialog.vue";
import ScheduleFormDialog from "../components/ScheduleFormDialog.vue";
import {
  createScheduleFormState,
  scheduleInputFromForm,
  type ScheduleFieldErrors,
} from "../components/schedule-form";
import { calendarUiIds, calendarUiSchedule } from "./calendar-ui-test-data";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  emits: ["close"],
  template: "<section v-if='open'><slot /></section>",
};

function mountForm(props: Record<string, unknown> = {}, realDialog = false) {
  const options = {
    attachTo: document.body,
    props: {
      open: true,
      defaultDate: "2026-08-06",
      customers: [{ id: calendarUiIds.customer, name: "합성 달력 고객" }],
      ...props,
    },
  };
  if (realDialog) return mount(ScheduleFormDialog, options);
  return mount(ScheduleFormDialog, {
    ...options,
    global: { stubs: { AppDialog: dialogStub } },
  });
}

describe("Schedule form UI", () => {
  afterEach(() => document.body.replaceChildren());

  it("defaults to the selected date, offers active customers, and exposes privacy and scalar limits", () => {
    const wrapper = mountForm();
    const title = wrapper.get("input[name='title']");
    const memo = wrapper.get("textarea[name='memo']");

    expect((wrapper.get("input[name='scheduledOn']").element as HTMLInputElement).value)
      .toBe("2026-08-06");
    expect(wrapper.get("input[name='scheduledOn']").attributes("max"))
      .toBe("9998-12-31");
    expect((wrapper.get("input[name='isCompleted']").element as HTMLInputElement).checked)
      .toBe(false);
    expect(wrapper.get("select[name='customerId']").text()).toContain("합성 달력 고객");
    expect(title.attributes("aria-describedby")).toContain("schedule-title-limit");
    expect(wrapper.get("#schedule-title-limit").text()).toContain("최대 200자");
    expect(title.attributes("maxlength")).toBeUndefined();
    expect(memo.attributes("maxlength")).toBeUndefined();
    expect(memo.attributes("aria-describedby")).toContain("schedule-memo-privacy");
    const privacy = wrapper.get("#schedule-memo-privacy").text();
    expect(privacy).toContain("최대 4,000자");
    expect(privacy).toContain("주민등록번호");
    expect(privacy).toContain("보험사 로그인 정보");
    expect(privacy).toContain("민감 병력이나 상세 병력");
    wrapper.unmount();
  });

  it("disambiguates duplicate customer names without exposing identifiers", () => {
    const secondId = "a1000000-0000-4000-8000-000000000002";
    const wrapper = mountForm({
      customers: [
        { id: calendarUiIds.customer, name: "합성 동명이인" },
        { id: secondId, name: "합성 동명이인" },
      ],
    });
    const options = wrapper.findAll("select[name='customerId'] option");

    expect(options.map((option) => option.text())).toEqual([
      "연결하지 않음",
      "합성 동명이인 (동명이인 1/2)",
      "합성 동명이인 (동명이인 2/2)",
    ]);
    expect(wrapper.text()).not.toContain(secondId);
    wrapper.unmount();
  });

  it("normalizes optional values and submits customer, time, memo, and completion", async () => {
    const wrapper = mountForm();
    await wrapper.get("input[name='title']").setValue("  합성 방문 일정  ");
    await wrapper.get("input[name='scheduledOn']").setValue("2026-08-07");
    await wrapper.get("input[name='scheduledTime']").setValue("09:05");
    await wrapper.get("textarea[name='memo']").setValue("  합성 다음 단계  ");
    await wrapper.get("select[name='customerId']").setValue(calendarUiIds.customer);
    await wrapper.get("input[name='isCompleted']").setValue(true);
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      title: "합성 방문 일정",
      scheduledOn: "2026-08-07",
      scheduledTime: "09:05",
      memo: "합성 다음 단계",
      customerId: calendarUiIds.customer,
      isCompleted: true,
    });
    wrapper.unmount();
  });

  it("accepts Unicode scalar limits and rejects invalid date, time, and over-limit text", () => {
    const errors: ScheduleFieldErrors = {};
    const form = createScheduleFormState();
    form.title = "😀".repeat(200);
    form.scheduledOn = "2026-08-06";
    form.memo = "✨".repeat(4_000);
    expect(scheduleInputFromForm(form, errors)).toBeDefined();

    form.title = "😀".repeat(201);
    form.memo = "✨".repeat(4_001);
    form.scheduledOn = "2026-02-30";
    form.scheduledTime = "24:00";
    expect(scheduleInputFromForm(form, errors)).toBeUndefined();
    expect(errors.title).toContain("200자");
    expect(errors.memo).toContain("4,000자");
    expect(errors.scheduledOn).toContain("실제 날짜");
    expect(errors.scheduledTime).toContain("실제 시간");

    form.title = "합성 범위 밖 일정";
    form.memo = "";
    form.scheduledTime = "";
    form.scheduledOn = "9999-01-01";
    expect(scheduleInputFromForm(form, errors)).toBeUndefined();
    expect(errors.scheduledOn).toContain("9998-12-31");
  });

  it("focuses the first rejected field without echoing rejected input", async () => {
    const wrapper = mountForm();
    await wrapper.get("input[name='title']").setValue("");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    const title = wrapper.get("input[name='title']");
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(title.attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(title.element);
    expect(wrapper.text()).not.toContain("private-rejected-schedule-marker");
    wrapper.unmount();
  });

  it("restores every editable field including customer, memo, and completed state", () => {
    const wrapper = mountForm({ schedule: calendarUiSchedule });
    expect((wrapper.get("input[name='title']").element as HTMLInputElement).value)
      .toBe(calendarUiSchedule.title);
    expect((wrapper.get("input[name='scheduledTime']").element as HTMLInputElement).value)
      .toBe("15:30");
    expect((wrapper.get("textarea[name='memo']").element as HTMLTextAreaElement).value)
      .toBe(calendarUiSchedule.memo);
    expect((wrapper.get("select[name='customerId']").element as HTMLSelectElement).value)
      .toBe(calendarUiIds.customer);
    expect((wrapper.get("input[name='isCompleted']").element as HTMLInputElement).checked)
      .toBe(true);
    expect(wrapper.text()).toContain("변경사항 저장");
    wrapper.unmount();
  });

  it("closes on Escape and returns focus to the opening control", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "일정 열기";
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mountForm({ open: false }, true);

    await wrapper.setProps({ open: true });
    await flushPromises();
    const title = document.body.querySelector<HTMLInputElement>("input[name='title']")!;
    expect(document.activeElement).toBe(title);
    const dialog = document.body.querySelector<HTMLDialogElement>("dialog")!;
    dialog.dispatchEvent(new KeyboardEvent("keydown", {
      key: "Escape",
      bubbles: true,
      cancelable: true,
    }));
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    await flushPromises();
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
  });

  it("focuses safe cancellation in delete confirmation and restores its trigger", async () => {
    const trigger = document.createElement("button");
    trigger.textContent = "일정 삭제 열기";
    document.body.append(trigger);
    trigger.focus();
    const wrapper = mount(ScheduleDeleteDialog, {
      attachTo: document.body,
      props: { open: false, title: "합성 삭제 일정" },
    });

    await wrapper.setProps({ open: true });
    await flushPromises();
    const cancel = Array.from(document.body.querySelectorAll("button"))
      .find((button) => button.textContent === "취소")!;
    expect(document.activeElement).toBe(cancel);
    document.body.querySelector<HTMLDialogElement>("dialog")?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }),
    );
    expect(wrapper.emitted("close")).toHaveLength(1);

    await wrapper.setProps({ open: false });
    await flushPromises();
    expect(document.activeElement).toBe(trigger);
    wrapper.unmount();
  });
});
