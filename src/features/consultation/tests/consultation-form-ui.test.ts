// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { describe, expect, it } from "vitest";

import ConsultationFormDialog from "../components/ConsultationFormDialog.vue";
import {
  consultationInputFromForm,
  createConsultationFormState,
  type ConsultationFieldErrors,
} from "../components/consultation-form";
import { localDateTimeToUtcTimestamp } from "../services/consultation-datetime";
import type { Consultation } from "../types/consultation";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

const timestamp = "2026-08-06T01:02:03.000Z";

function consultation(): Consultation {
  return {
    id: "81000000-0000-4000-8000-000000000001",
    customerId: "82000000-0000-4000-8000-000000000001",
    consultedAt: timestamp,
    content: "합성 상담 내용",
    nextContactOn: "2026-08-20",
    result: "합성 결과",
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

function mountForm(props: Record<string, unknown> = {}) {
  return mount(ConsultationFormDialog, {
    props: { open: true, ...props },
    attachTo: document.body,
    global: { stubs: { AppDialog: dialogStub } },
  });
}

describe("Consultation form UI", () => {
  it("connects visible privacy and scalar-limit hints", () => {
    const wrapper = mountForm();
    const content = wrapper.get("textarea[name='content']");
    const result = wrapper.get("input[name='result']");

    expect(content.attributes("aria-describedby")).toContain(
      "consultation-content-privacy",
    );
    expect(wrapper.get("#consultation-content-privacy").text()).toContain(
      "민감 병력이나 상세 병력",
    );
    expect(wrapper.get("#consultation-content-privacy").text()).toContain("최대 4,000자");
    expect(wrapper.get("#consultation-result-limit").text()).toContain("최대 200자");
    expect(result.attributes("aria-describedby")).toContain("consultation-result-limit");
    expect(content.attributes("maxlength")).toBeUndefined();
    expect(result.attributes("maxlength")).toBeUndefined();
    expect(wrapper.get("input[name='consultedAt']").attributes("autofocus"))
      .toBeDefined();
    wrapper.unmount();
  });

  it("normalizes local form values into the application input", async () => {
    const wrapper = mountForm();
    const local = "2026-08-06T10:30";
    await wrapper.get("input[name='consultedAt']").setValue(local);
    await wrapper.get("textarea[name='content']").setValue("  합성 상담 기록  ");
    await wrapper.get("input[name='nextContactOn']").setValue("");
    await wrapper.get("input[name='result']").setValue("  합성 완료  ");
    await wrapper.get("form").trigger("submit");

    expect(wrapper.emitted("submit")?.[0]?.[0]).toEqual({
      consultedAt: localDateTimeToUtcTimestamp(local),
      content: "합성 상담 기록",
      nextContactOn: null,
      result: "합성 완료",
    });
    wrapper.unmount();
  });

  it("focuses the first invalid field without echoing rejected content", async () => {
    const wrapper = mountForm();
    await wrapper.get("input[name='consultedAt']").setValue("");
    await wrapper.get("form").trigger("submit");
    await nextTick();

    const consultedAt = wrapper.get("input[name='consultedAt']");
    expect(consultedAt.attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(consultedAt.element);
    expect(wrapper.text()).not.toContain("private-rejected-marker-006");
    wrapper.unmount();
  });

  it("counts emoji as Unicode scalars and rejects over-limit submit", async () => {
    const errors: ConsultationFieldErrors = {};
    const form = createConsultationFormState(null, new Date(timestamp));
    form.content = "😀".repeat(4_000);
    form.result = "✨".repeat(200);
    expect(consultationInputFromForm(form, errors)).toBeDefined();
    form.content = "😀".repeat(4_001);
    expect(consultationInputFromForm(form, errors)).toBeUndefined();
    expect(errors.content).toContain("4,000자");

    const wrapper = mountForm();
    await wrapper.get("textarea[name='content']").setValue("😀".repeat(4_001));
    await wrapper.get("form").trigger("submit");
    await nextTick();
    expect(wrapper.emitted("submit")).toBeUndefined();
    expect(wrapper.get("textarea[name='content']").attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(wrapper.get("textarea[name='content']").element);
    wrapper.unmount();
  });

  it("restores UTC values for editing", () => {
    const wrapper = mountForm({ consultation: consultation() });
    const content = wrapper.get("textarea[name='content']").element as HTMLTextAreaElement;
    const nextContact = wrapper.get("input[name='nextContactOn']").element as HTMLInputElement;
    const consultedAt = wrapper.get("input[name='consultedAt']").element as HTMLInputElement;
    expect(content.value).toBe("합성 상담 내용");
    expect(nextContact.value).toBe("2026-08-20");
    expect(consultedAt.value).not.toBe("");
    wrapper.unmount();
  });
});
