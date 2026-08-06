// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const applicationMocks = vi.hoisted(() => ({ updateTheme: vi.fn() }));

vi.mock("@/app/composition/settings", () => ({
  appSettingsApplication: applicationMocks,
}));

import AppShell from "@/app/shell/AppShell.vue";

async function mountShell() {
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
  return mount(AppShell, {
    attachTo: document.body,
    global: { plugins: [createPinia(), router] },
  });
}

describe("AppShell canonical theme toggle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    applicationMocks.updateTheme.mockResolvedValue({ theme: "dark" });
  });

  afterEach(() => {
    document.body.replaceChildren();
    document.documentElement.removeAttribute("data-theme");
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("persists the requested theme and applies the canonical response", async () => {
    const wrapper = await mountShell();
    const button = wrapper.get(".topbar-actions .icon-button");
    expect(button.attributes("aria-pressed")).toBe("false");

    await button.trigger("click");
    await flushPromises();

    expect(applicationMocks.updateTheme).toHaveBeenCalledWith("dark");
    expect(button.attributes("aria-pressed")).toBe("true");
    expect(document.documentElement.dataset.theme).toBe("dark");
    wrapper.unmount();
  });

  it("rolls back and announces a safe error when persistence fails", async () => {
    applicationMocks.updateTheme.mockRejectedValue(
      new Error("private-theme-marker"),
    );
    const wrapper = await mountShell();
    const button = wrapper.get(".topbar-actions .icon-button");
    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-pressed")).toBe("false");
    const alert = wrapper.get(".topbar-actions [role='alert']");
    expect(alert.text()).toContain("설정 작업을 완료하지 못했습니다");
    expect(alert.text()).not.toContain("private-theme-marker");
    wrapper.unmount();
  });
});
