<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

import { appSettingsApplication } from "@/app/composition/settings";
import { useUiStore } from "@/app/stores/ui";
import { appSettingsSafeMessage } from "@/features/settings/types/app-settings-error";
import AppIcon from "@/shared/components/AppIcon.vue";

const ui = useUiStore();
const route = useRoute();

const pageTitle = computed(() => String(route.meta.title ?? "BODAM"));
const pageDescription = computed(() => String(route.meta.description ?? ""));
const mobileViewport = ref(false);
const navigationToggle = ref<HTMLButtonElement>();
const sidebar = ref<HTMLElement>();
const mainContent = ref<HTMLElement>();
const themeSaving = ref(false);
const themeError = ref<string>();
let mobileQuery: MediaQueryList | undefined;

const navigationToggleLabel = computed(() => {
  if (mobileViewport.value) {
    return ui.mobileNavigationOpen ? "메뉴 닫기" : "메뉴 열기";
  }
  return ui.sidebarCollapsed ? "사이드바 펼치기" : "사이드바 접기";
});

const navigationExpanded = computed(() =>
  mobileViewport.value ? ui.mobileNavigationOpen : !ui.sidebarCollapsed,
);
const mobileNavigationActive = computed(
  () => mobileViewport.value && ui.mobileNavigationOpen,
);

function updateMobileViewport(event: MediaQueryListEvent) {
  mobileViewport.value = event.matches;
  if (!event.matches) ui.closeMobileNavigation();
}

function closeMobileNavigation(focusTarget?: "toggle" | "main") {
  const wasMobileOpen = mobileNavigationActive.value;
  ui.closeMobileNavigation();
  if (!wasMobileOpen || focusTarget === undefined) return;
  void nextTick(() => {
    if (focusTarget === "toggle") navigationToggle.value?.focus();
    else mainContent.value?.focus();
  });
}

async function toggleNavigation() {
  const openingMobile = mobileViewport.value && !ui.mobileNavigationOpen;
  ui.toggleNavigation();
  if (!openingMobile) return;
  await nextTick();
  const activeItem = sidebar.value?.querySelector<HTMLElement>(
    ".nav-item.router-link-active:not([disabled])",
  );
  const fallbackItem = sidebar.value?.querySelector<HTMLElement>(
    ".nav-item:not([disabled])",
  );
  (activeItem ?? fallbackItem)?.focus();
}

function isNavigationActive(path: string | undefined): boolean {
  if (!path) return false;
  return route.path === path || (path === "/customers" && route.name === "customer-detail");
}

function handleWindowKeydown(event: KeyboardEvent) {
  if (event.key !== "Escape" || !mobileViewport.value || !ui.mobileNavigationOpen) return;
  event.preventDefault();
  closeMobileNavigation("toggle");
}

async function toggleTheme() {
  if (themeSaving.value) return;
  const previous = ui.theme;
  const requested = ui.toggleTheme();
  themeSaving.value = true;
  themeError.value = undefined;
  try {
    ui.setTheme((await appSettingsApplication.updateTheme(requested)).theme);
  } catch (error: unknown) {
    ui.setTheme(previous);
    themeError.value = appSettingsSafeMessage(error);
  } finally {
    themeSaving.value = false;
  }
}

onMounted(() => {
  mobileQuery = window.matchMedia("(max-width: 860px)");
  mobileViewport.value = mobileQuery.matches;
  mobileQuery.addEventListener("change", updateMobileViewport);
  window.addEventListener("keydown", handleWindowKeydown);
});

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", updateMobileViewport);
  window.removeEventListener("keydown", handleWindowKeydown);
});

const navigation = [
  { label: "대시보드", icon: "dashboard" as const, to: "/dashboard" },
  { label: "고객", icon: "customers" as const, to: "/customers" },
  { label: "가족", icon: "family" as const, to: "/families" },
  { label: "보험계약", icon: "policy" as const, pending: true, customerScoped: true },
  { label: "달력", icon: "calendar" as const, to: "/calendar" },
];

const utilities = [
  { label: "데이터 관리", icon: "database" as const, to: "/data-exchange" },
  { label: "설정", icon: "settings" as const, to: "/settings" },
];
</script>

<template>
  <a class="skip-link" href="#main-content" :inert="mobileNavigationActive">
    본문으로 건너뛰기
  </a>
  <div
    class="app-shell"
    :class="{
      'is-collapsed': ui.sidebarCollapsed && !mobileViewport,
      'is-mobile-open': ui.mobileNavigationOpen,
    }"
  >
    <button
      v-if="ui.mobileNavigationOpen"
      class="sidebar-backdrop"
      type="button"
      aria-label="메뉴 닫기"
      @click="closeMobileNavigation('toggle')"
    />

    <aside id="primary-navigation" ref="sidebar" class="sidebar" aria-label="주 메뉴">
      <div class="brand">
        <span class="brand-mark" aria-hidden="true">B</span>
        <span class="brand-copy">
          <strong>BODAM</strong>
          <small>Insurance workspace</small>
        </span>
      </div>

      <nav class="sidebar-nav">
        <p class="nav-heading">업무</p>
        <template v-for="item in navigation" :key="item.label">
          <RouterLink
            v-if="item.to"
            class="nav-item"
            :class="{ 'router-link-active': isNavigationActive(item.to) }"
            :to="item.to"
            :title="ui.sidebarCollapsed ? item.label : undefined"
            @click="closeMobileNavigation('main')"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
          <button
            v-else
            class="nav-item is-pending"
            type="button"
            disabled
            :title="item.customerScoped ? `${item.label} — 고객 상세에서 관리` : `${item.label} — 준비 중`"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
            <em>{{ item.customerScoped ? "고객별" : "준비 중" }}</em>
          </button>
        </template>

        <p class="nav-heading nav-heading-utility">관리</p>
        <template v-for="item in utilities" :key="item.label">
          <RouterLink
            v-if="item.to"
            class="nav-item"
            :class="{ 'router-link-active': isNavigationActive(item.to) }"
            :to="item.to"
            :title="ui.sidebarCollapsed ? item.label : undefined"
            @click="closeMobileNavigation('main')"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
          </RouterLink>
          <button
            v-else
            class="nav-item is-pending"
            type="button"
            disabled
            :title="`${item.label} — 준비 중`"
          >
            <AppIcon :name="item.icon" />
            <span>{{ item.label }}</span>
            <em>준비 중</em>
          </button>
        </template>
      </nav>

      <div class="sidebar-footer">
        <span class="offline-dot" aria-hidden="true" />
        <span>이 PC에 로컬 저장</span>
      </div>
    </aside>

    <section class="workspace" :inert="mobileNavigationActive">
      <header class="topbar">
        <button
          ref="navigationToggle"
          class="icon-button navigation-toggle"
          type="button"
          :aria-label="navigationToggleLabel"
          :aria-expanded="navigationExpanded"
          aria-controls="primary-navigation"
          @click="toggleNavigation"
        >
          <AppIcon
            :name="mobileViewport
              ? (ui.mobileNavigationOpen ? 'chevron-left' : 'menu')
              : (ui.sidebarCollapsed ? 'menu' : 'chevron-left')"
          />
        </button>

        <div class="page-heading">
          <h1>{{ pageTitle }}</h1>
          <p>{{ pageDescription }}</p>
        </div>

        <div class="topbar-actions">
          <span class="local-badge">
            <span aria-hidden="true" />
            오프라인
          </span>
          <button
            class="icon-button"
            type="button"
            :disabled="themeSaving"
            :aria-busy="themeSaving"
            :aria-label="ui.theme === 'light' ? '다크 모드 사용' : '라이트 모드 사용'"
            @click="toggleTheme"
          >
            <AppIcon :name="ui.theme === 'light' ? 'moon' : 'sun'" />
          </button>
          <p v-if="themeError" class="sr-only" role="alert">{{ themeError }}</p>
        </div>
      </header>

      <main id="main-content" ref="mainContent" class="main-content" tabindex="-1">
        <RouterView />
      </main>
    </section>
  </div>
</template>
