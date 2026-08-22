import { flushPromises, mount } from "@vue/test-utils";
import { createPinia } from "pinia";
import { defineComponent, nextTick } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, describe, expect, it, vi } from "vitest";

import AppShell from "./AppShell.vue";

function mockMobileViewport() {
  vi.spyOn(window, "matchMedia").mockReturnValue({
    matches: true,
    media: "(max-width: 860px)",
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  });
}

describe("AppShell mobile navigation", () => {
  afterEach(() => vi.restoreAllMocks());

  it("closes on Escape and restores focus to the menu trigger", async () => {
    mockMobileViewport();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [{ path: "/", component: defineComponent({ template: "<p>화면</p>" }) }],
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router] },
    });

    const trigger = wrapper.get("button.navigation-toggle");
    await trigger.trigger("click");
    await nextTick();
    expect(trigger.attributes("aria-expanded")).toBe("true");
    expect(wrapper.get(".workspace").attributes()).toHaveProperty("inert");
    expect(wrapper.get(".skip-link").attributes()).toHaveProperty("inert");
    expect(document.activeElement).toBe(
      wrapper.get(".sidebar .nav-item:not([disabled])").element,
    );
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    await nextTick();

    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(wrapper.get(".workspace").attributes()).not.toHaveProperty("inert");
    expect(wrapper.get(".skip-link").attributes()).not.toHaveProperty("inert");
    expect(document.activeElement).toBe(trigger.element);
    wrapper.unmount();
  });

  it("focuses the active customer section when opened from customer detail", async () => {
    mockMobileViewport();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        {
          path: "/customers/:customerId",
          name: "customer-detail",
          component: defineComponent({ template: "<p>고객 상세</p>" }),
        },
        { path: "/:pathMatch(.*)*", component: defineComponent({ template: "<p>다른 화면</p>" }) },
      ],
    });
    await router.push("/customers/synthetic-customer");
    await router.isReady();
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router] },
    });

    await wrapper.get("button.navigation-toggle").trigger("click");
    await nextTick();

    const customerLink = wrapper.get("a.nav-item[href='/customers']");
    expect(customerLink.classes()).toContain("router-link-active");
    expect(document.activeElement).toBe(customerLink.element);
    wrapper.unmount();
  });

  it("moves focus to the main content after following a mobile navigation link", async () => {
    mockMobileViewport();
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/", component: defineComponent({ template: "<p>처음 화면</p>" }) },
        { path: "/dashboard", component: defineComponent({ template: "<p>대시보드 화면</p>" }) },
        { path: "/:pathMatch(.*)*", component: defineComponent({ template: "<p>다른 화면</p>" }) },
      ],
    });
    await router.push("/");
    await router.isReady();
    const wrapper = mount(AppShell, {
      attachTo: document.body,
      global: { plugins: [createPinia(), router] },
    });

    await wrapper.get("button.navigation-toggle").trigger("click");
    await nextTick();
    await wrapper.get("a.nav-item[href='/dashboard']").trigger("click");
    await flushPromises();

    expect(router.currentRoute.value.path).toBe("/dashboard");
    expect(wrapper.get(".workspace").attributes()).not.toHaveProperty("inert");
    expect(document.activeElement).toBe(wrapper.get("#main-content").element);
    wrapper.unmount();
  });
});
