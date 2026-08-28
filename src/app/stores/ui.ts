import { defineStore } from "pinia";
import { ref } from "vue";

import type {
  ResolvedTheme,
  ThemeMode,
} from "@/features/settings/types/app-settings";

export const THEME_CACHE_KEY = "bodam.ui.theme";
export const SYSTEM_THEME_QUERY = "(prefers-color-scheme: dark)";
const SIDEBAR_KEY = "bodam.ui.sidebar-collapsed";

function cachedTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_CACHE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // The canonical Settings repository remains available without this cache.
  }
  return "light";
}

function cacheTheme(theme: ThemeMode): void {
  try {
    localStorage.setItem(THEME_CACHE_KEY, theme);
  } catch {
    // Theme cache failure must not prevent applying canonical Settings.
  }
}

export const useUiStore = defineStore("ui", () => {
  const themePreference = ref<ThemeMode>("light");
  const resolvedTheme = ref<ResolvedTheme>("light");
  const sidebarCollapsed = ref(false);
  const mobileNavigationOpen = ref(false);
  let systemThemeQuery: MediaQueryList | undefined;
  let themeListenerAttached = false;

  function ensureSystemThemeQuery(): MediaQueryList | undefined {
    if (!systemThemeQuery && typeof window !== "undefined" && window.matchMedia) {
      systemThemeQuery = window.matchMedia(SYSTEM_THEME_QUERY);
    }
    return systemThemeQuery;
  }

  function resolveTheme(theme: ThemeMode): ResolvedTheme {
    if (theme !== "system") return theme;
    return ensureSystemThemeQuery()?.matches ? "dark" : "light";
  }

  function applyTheme(): void {
    resolvedTheme.value = resolveTheme(themePreference.value);
    if (typeof document === "undefined") return;
    document.documentElement.dataset.theme = resolvedTheme.value;
    document.documentElement.style.colorScheme = resolvedTheme.value;
  }

  function handleSystemThemeChange(): void {
    if (themePreference.value === "system") applyTheme();
  }

  function startThemeListener(): void {
    const query = ensureSystemThemeQuery();
    if (query && !themeListenerAttached) {
      query.addEventListener("change", handleSystemThemeChange);
      themeListenerAttached = true;
    }
    applyTheme();
  }

  function stopThemeListener(): void {
    if (systemThemeQuery && themeListenerAttached) {
      systemThemeQuery.removeEventListener("change", handleSystemThemeChange);
    }
    themeListenerAttached = false;
    systemThemeQuery = undefined;
  }

  function initialize(): void {
    themePreference.value = cachedTheme();
    try {
      sidebarCollapsed.value = localStorage.getItem(SIDEBAR_KEY) === "true";
    } catch {
      sidebarCollapsed.value = false;
    }
    applyTheme();
  }

  function setThemePreference(theme: ThemeMode): void {
    themePreference.value = theme;
    cacheTheme(theme);
    applyTheme();
  }

  function nextThemePreference(): ThemeMode {
    const next: Record<ThemeMode, ThemeMode> = {
      light: "dark",
      dark: "system",
      system: "light",
    };
    return next[themePreference.value];
  }

  function toggleNavigation(): void {
    if (window.matchMedia("(max-width: 860px)").matches) {
      mobileNavigationOpen.value = !mobileNavigationOpen.value;
      return;
    }

    sidebarCollapsed.value = !sidebarCollapsed.value;
    localStorage.setItem(SIDEBAR_KEY, String(sidebarCollapsed.value));
  }

  function closeMobileNavigation(): void {
    mobileNavigationOpen.value = false;
  }

  return {
    themePreference,
    resolvedTheme,
    sidebarCollapsed,
    mobileNavigationOpen,
    initialize,
    applyTheme,
    setThemePreference,
    nextThemePreference,
    startThemeListener,
    stopThemeListener,
    toggleNavigation,
    closeMobileNavigation,
  };
});
