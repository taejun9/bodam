// @vitest-environment happy-dom

import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SYSTEM_THEME_QUERY,
  THEME_CACHE_KEY,
  useUiStore,
} from "@/app/stores/ui";

interface MutableMediaQuery extends Omit<MediaQueryList, "matches"> {
  matches: boolean;
  dispatchChange(matches: boolean): void;
}

function mockSystemTheme(initiallyDark: boolean): MutableMediaQuery {
  const listeners = new Set<EventListener>();
  const query = {
    matches: initiallyDark,
    media: SYSTEM_THEME_QUERY,
    onchange: null,
    addEventListener: vi.fn((_type: string, listener: EventListener) => {
      listeners.add(listener);
    }),
    removeEventListener: vi.fn((_type: string, listener: EventListener) => {
      listeners.delete(listener);
    }),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(() => true),
    dispatchChange(matches: boolean) {
      query.matches = matches;
      for (const listener of listeners) listener(new Event("change"));
    },
  } satisfies MutableMediaQuery;
  vi.spyOn(window, "matchMedia").mockImplementation((media) => {
    expect(media).toBe(SYSTEM_THEME_QUERY);
    return query;
  });
  return query;
}

describe("ui theme first-paint cache", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute("data-theme");
    setActivePinia(createPinia());
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("uses approved light when no canonical cache exists", () => {
    const ui = useUiStore();
    ui.initialize();

    expect(ui.themePreference).toBe("light");
    expect(ui.resolvedTheme).toBe("light");
    expect(document.documentElement.dataset.theme).toBe("light");
  });

  it("applies and refreshes the cache without making it canonical", () => {
    localStorage.setItem(THEME_CACHE_KEY, "dark");
    const ui = useUiStore();
    ui.initialize();
    expect(ui.themePreference).toBe("dark");

    ui.setThemePreference("light");
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe("light");
  });

  it("keeps the system preference while applying runtime OS theme changes", () => {
    const query = mockSystemTheme(true);
    localStorage.setItem(THEME_CACHE_KEY, "system");
    const ui = useUiStore();

    ui.initialize();
    ui.startThemeListener();
    ui.startThemeListener();

    expect(ui.themePreference).toBe("system");
    expect(ui.resolvedTheme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(query.addEventListener).toHaveBeenCalledOnce();

    query.dispatchChange(false);

    expect(ui.themePreference).toBe("system");
    expect(ui.resolvedTheme).toBe("light");
    expect(document.documentElement.style.colorScheme).toBe("light");
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe("system");

    ui.stopThemeListener();
    expect(query.removeEventListener).toHaveBeenCalledOnce();
  });

  it("derives the next preference without changing the stored theme", () => {
    mockSystemTheme(true);
    const ui = useUiStore();
    ui.initialize();

    expect(ui.nextThemePreference()).toBe("dark");
    expect(ui.themePreference).toBe("light");
    ui.setThemePreference("dark");
    expect(ui.nextThemePreference()).toBe("system");
    ui.setThemePreference("system");
    expect(ui.themePreference).toBe("system");
    expect(ui.resolvedTheme).toBe("dark");
    expect(document.documentElement.dataset.theme).toBe("dark");
    expect(localStorage.getItem(THEME_CACHE_KEY)).toBe("system");
    expect(ui.nextThemePreference()).toBe("light");
  });
});
