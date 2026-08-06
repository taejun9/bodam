// @vitest-environment happy-dom

import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  THEME_CACHE_KEY,
  useUiStore,
} from "@/app/stores/ui";

describe("ui theme first-paint cache", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    setActivePinia(createPinia());
  });

  afterEach(() => localStorage.clear());

  it("uses approved light when no canonical cache exists", () => {
    const ui = useUiStore();
    ui.initialize();

    expect(ui.theme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applies and refreshes the cache without making it canonical", () => {
    localStorage.setItem(THEME_CACHE_KEY, "dark");
    const ui = useUiStore();
    ui.initialize();
    expect(ui.theme).toBe("dark");

    ui.setTheme("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe("light");
  });
});
