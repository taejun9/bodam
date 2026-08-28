// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SYSTEM_THEME_QUERY, useUiStore } from "@/app/stores/ui";

const applicationMocks = vi.hoisted(() => ({ updateTheme: vi.fn() }));

vi.mock("@/app/composition/settings", () => ({
  appSettingsApplication: applicationMocks,
}));

import AppShell from "@/app/shell/AppShell.vue";

function mockMatchMedia(systemDark = false): void {
  vi.spyOn(window, "matchMedia").mockImplementation((media) => ({
    matches: media === SYSTEM_THEME_QUERY ? systemDark : false,
    media,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
  }));
}

async function mountShell() {
  const pinia = createPinia();
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{
      path: "/",
      component: defineComponent({ template: "<p>합성 화면</p>" }),
    }, {
      path: "/:pathMatch(.*)*",
      component: defineComponent({ template: "<p>합성 다른 화면</p>" }),
    }],
  });
  await router.push("/");
  await router.isReady();
  const wrapper = mount(AppShell, {
    attachTo: document.body,
    global: { plugins: [pinia, router] },
  });
  return { wrapper, ui: useUiStore(pinia) };
}

describe("AppShell canonical theme toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    mockMatchMedia(true);
    applicationMocks.updateTheme.mockImplementation(async (theme) => ({ theme }));
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("cycles all three preferences and announces the next action", async () => {
    const { wrapper } = await mountShell();
    const button = wrapper.get(".topbar-actions .icon-button");
    expect(button.attributes("aria-pressed")).toBeUndefined();
    expect(button.attributes("aria-label")).toBe("다크 모드 사용");

    await button.trigger("click");
    await flushPromises();

    expect(applicationMocks.updateTheme).toHaveBeenCalledWith("dark");
    expect(button.attributes("aria-pressed")).toBeUndefined();
    expect(button.attributes("aria-label")).toBe("시스템 설정 사용");
    expect(document.documentElement.dataset.theme).toBe("dark");

    await button.trigger("click");
    await flushPromises();

    expect(applicationMocks.updateTheme).toHaveBeenLastCalledWith("system");
    expect(button.attributes("aria-label")).toBe("라이트 모드 사용");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem("bodam.ui.theme")).toBe("system");

    await button.trigger("click");
    await flushPromises();

    expect(applicationMocks.updateTheme).toHaveBeenLastCalledWith("light");
    expect(button.attributes("aria-label")).toBe("다크 모드 사용");
    expect(document.documentElement.dataset.theme).toBe("light");
    wrapper.unmount();
  });

  it("rolls back and announces a safe error when persistence fails", async () => {
    applicationMocks.updateTheme.mockRejectedValue(
      new Error("private-theme-marker"),
    );
    const { wrapper } = await mountShell();
    const button = wrapper.get(".topbar-actions .icon-button");
    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-pressed")).toBeUndefined();
    expect(button.attributes("aria-label")).toBe("다크 모드 사용");
    const alert = wrapper.get(".topbar-actions [role='alert']");
    expect(alert.text()).toContain("설정 작업을 완료하지 못했습니다");
    expect(alert.text()).not.toContain("private-theme-marker");
    wrapper.unmount();
  });

  it("does not overwrite a newer Settings result when theme persistence fails", async () => {
    let rejectTheme!: (reason: unknown) => void;
    applicationMocks.updateTheme.mockImplementation(() => new Promise(
      (_resolve, reject) => { rejectTheme = reject; },
    ));
    const { wrapper, ui } = await mountShell();
    const button = wrapper.get(".topbar-actions .icon-button");

    await button.trigger("click");
    expect(button.attributes()).toHaveProperty("disabled");
    expect(ui.themePreference).toBe("light");

    ui.setThemePreference("system");
    rejectTheme(new Error("synthetic concurrent failure"));
    await flushPromises();

    expect(ui.themePreference).toBe("system");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(button.attributes("aria-label")).toBe("라이트 모드 사용");
    wrapper.unmount();
  });
});
