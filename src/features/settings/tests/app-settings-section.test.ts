// @vitest-environment happy-dom

import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { createPinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  AppSettingsValidationError,
} from "../types/app-settings-error";

const applicationMocks = vi.hoisted(() => ({
  load: vi.fn(),
  update: vi.fn(),
}));

vi.mock("@/app/composition/settings", () => ({
  appSettingsApplication: applicationMocks,
}));

import AppSettingsSection from "../components/AppSettingsSection.vue";

const settings = {
  theme: "light" as const,
  recentConsultationDays: 30,
  unconsultedDays: 90,
  dashboardItemLimit: 10,
  backupDirectory: { kind: "default" as const, basename: null },
};

function mountSection(): VueWrapper {
  return mount(AppSettingsSection, {
    attachTo: document.body,
    global: { plugins: [createPinia()] },
  });
}

describe("AppSettingsSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationMocks.load.mockResolvedValue(settings);
    applicationMocks.update.mockResolvedValue(settings);
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("loads exact preferences and saves all four editable fields", async () => {
    vi.spyOn(window, "matchMedia").mockReturnValue({
      matches: false,
      media: "(prefers-color-scheme: dark)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(() => true),
    });
    const wrapper = mountSection();
    await flushPromises();
    expect(wrapper.findAll("input[name='theme']")).toHaveLength(3);
    expect(wrapper.get("input[name='recentConsultationDays']").element)
      .toHaveProperty("value", "30");
    expect(wrapper.get("input[name='unconsultedDays']").element)
      .toHaveProperty("value", "90");

    await wrapper.get("input[value='system']").setValue(true);
    await wrapper.get("input[name='recentConsultationDays']").setValue("45");
    await wrapper.get("input[name='unconsultedDays']").setValue("120");
    await wrapper.get("input[name='dashboardItemLimit']").setValue("7");
    applicationMocks.update.mockResolvedValue({
      ...settings,
      theme: "system",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(applicationMocks.update).toHaveBeenCalledWith({
      theme: "system",
      recentConsultationDays: 45,
      unconsultedDays: 120,
      dashboardItemLimit: 7,
    });
    const result = wrapper.get("[role='status'].app-settings-result");
    expect(result.text()).toContain("설정을 저장했습니다");
    expect(document.activeElement).toBe(result.element);
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("focuses the first invalid preference and marks it for assistive tech", async () => {
    applicationMocks.update.mockRejectedValue(new AppSettingsValidationError([{
      field: "unconsultedDays",
      message: "미상담 기준은 최근 상담 기간 이상이어야 합니다.",
    }]));
    const wrapper = mountSection();
    await flushPromises();
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    const field = wrapper.get<HTMLInputElement>("input[name='unconsultedDays']");
    expect(field.attributes("aria-invalid")).toBe("true");
    expect(document.activeElement).toBe(field.element);
    expect(wrapper.text()).toContain("미상담 기준은 최근 상담 기간 이상");
  });

  it("shows and focuses a privacy-safe retryable load error", async () => {
    applicationMocks.load.mockRejectedValue(new Error("private-settings-marker"));
    const wrapper = mountSection();
    await flushPromises();

    const alert = wrapper.get("[role='alert']");
    expect(alert.text()).toContain("설정 작업을 완료하지 못했습니다");
    expect(alert.text()).not.toContain("private-settings-marker");
    applicationMocks.load.mockResolvedValue(settings);
    await alert.get("button").trigger("click");
    await flushPromises();
    expect(document.activeElement).toBe(
      wrapper.get("input[name='theme']").element,
    );
  });
});
