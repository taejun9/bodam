import { defineStore } from "pinia";

export type ThemeMode = "light" | "dark";

const THEME_KEY = "bodam.ui.theme";
const SIDEBAR_KEY = "bodam.ui.sidebar-collapsed";

function preferredTheme(): ThemeMode {
  const stored = localStorage.getItem(THEME_KEY);
  if (stored === "light" || stored === "dark") return stored;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export const useUiStore = defineStore("ui", {
  state: () => ({
    theme: "light" as ThemeMode,
    sidebarCollapsed: false,
    mobileNavigationOpen: false,
  }),
  actions: {
    initialize() {
      this.theme = preferredTheme();
      this.sidebarCollapsed = localStorage.getItem(SIDEBAR_KEY) === "true";
      this.applyTheme();
    },
    applyTheme() {
      document.documentElement.dataset.theme = this.theme;
      document.documentElement.style.colorScheme = this.theme;
    },
    toggleTheme() {
      this.theme = this.theme === "light" ? "dark" : "light";
      localStorage.setItem(THEME_KEY, this.theme);
      this.applyTheme();
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
