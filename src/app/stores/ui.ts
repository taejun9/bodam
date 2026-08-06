import { defineStore } from "pinia";

import type { ThemeMode } from "@/features/settings/types/app-settings";

export const THEME_CACHE_KEY = "bodam.ui.theme";
const SIDEBAR_KEY = "bodam.ui.sidebar-collapsed";

function cachedTheme(): ThemeMode {
  try {
    const stored = localStorage.getItem(THEME_CACHE_KEY);
    if (stored === "light" || stored === "dark") return stored;
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

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: "light" as ThemeMode,
    sidebarCollapsed: false,
    mobileNavigationOpen: false,
  }),
  actions: {
    initialize() {
      this.theme = cachedTheme();
      this.sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.theme;
      document.documentElement.style.colorScheme = this.theme;
    },
    setTheme(theme: ThemeMode) {
      this.theme = theme;
      cacheTheme(theme);
      this.applyTheme();
    },
    toggleTheme(): ThemeMode {
      const theme = this.theme === "light" ? "dark" : "light";
      this.setTheme(theme);
      return theme;
    },
    toggleNavigation() {
      if (window.matchMedia("(max-width: 860px)").matches) {
        this.mobileNavigationOpen = !this.mobileNavigationOpen;
        return;
      }

      this.sidebarCollapsed = !this.sidebarCollapsed;
      localStorage.setItem(SIDEBAR_KEY, String(this.sidebarCollapsed));
    },
    closeMobileNavigation() {
      this.mobileNavigationOpen = false;
    },
  },
});
