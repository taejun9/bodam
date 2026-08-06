// @vitest-environment happy-dom

import { shallowMount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import SettingsPage from "../pages/SettingsPage.vue";

describe("SettingsPage", () => {
  it("keeps preferences and the existing benchmark inside one labelled page", () => {
    const wrapper = shallowMount(SettingsPage, {
      global: {
        stubs: {
          AppSettingsSection: { template: "<section data-preferences />" },
          CoverageBenchmarkSection: { template: "<section data-benchmark />" },
        },
      },
    });

    expect(wrapper.get(".settings-page").attributes("aria-labelledby"))
      .toBe("settings-page-title");
    expect(wrapper.get("#settings-page-title").text()).toBe("환경과 업무 기준");
    expect(wrapper.get("[data-preferences]").element.tagName).toBe("SECTION");
    expect(wrapper.get("[data-benchmark]").element.tagName).toBe("SECTION");
  });
});
