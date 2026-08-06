<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { RouterLink, RouterView, useRoute } from "vue-router";

import { useUiStore } from "@/app/stores/ui";
import AppIcon from "@/shared/components/AppIcon.vue";

const ui = useUiStore();
const route = useRoute();

const pageTitle = computed(() => String(route.meta.title ?? "BODAM"));
const pageDescription = computed(() => String(route.meta.description ?? ""));
const mobileViewport = ref(false);
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

function updateMobileViewport(event: MediaQueryListEvent) {
  mobileViewport.value = event.matches;
  if (!event.matches) ui.closeMobileNavigation();
}

onMounted(() => {
  mobileQuery = window.matchMedia("(max-width: 860px)");
  mobileViewport.value = mobileQuery.matches;
  mobileQuery.addEventListener("change", updateMobileViewport);
});

onBeforeUnmount(() => {
  mobileQuery?.removeEventListener("change", updateMobileViewport);
});

const navigation = [
  { label: "대시보드", icon: "dashboard" as const, pending: true },
  { label: "고객", icon: "customers" as const, to: "/customers" },
  { label: "가족", icon: "family" as const, pending: true },
  { label: "보험계약", icon: "policy" as const, pending: true, customerScoped: true },
  { label: "달력", icon: "calendar" as const, pending: true },
];

const utilities = [
  { label: "데이터 관리", icon: "database" as const },
  { label: "설정", icon: "settings" as const },
];
</script>

<template>
  <a class="skip-link" href="#main-content">본문으로 건너뛰기</a>
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
      @click="ui.closeMobileNavigation"
    />

    <aside class="sidebar" aria-label="주 메뉴">
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
            :to="item.to"
            :title="ui.sidebarCollapsed ? item.label : undefined"
            @click="ui.closeMobileNavigation"
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
        <button
          v-for="item in utilities"
          :key="item.label"
          class="nav-item is-pending"
          type="button"
          disabled
          :title="`${item.label} — 준비 중`"
        >
          <AppIcon :name="item.icon" />
          <span>{{ item.label }}</span>
          <em>준비 중</em>
        </button>
      </nav>

      <div class="sidebar-footer">
        <span class="offline-dot" aria-hidden="true" />
        <span>이 PC에 로컬 저장</span>
      </div>
    </aside>

    <section class="workspace">
      <header class="topbar">
        <button
          class="icon-button navigation-toggle"
          type="button"
          :aria-label="navigationToggleLabel"
          :aria-expanded="navigationExpanded"
          @click="ui.toggleNavigation"
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
            :aria-label="ui.theme === 'light' ? '다크 모드 사용' : '라이트 모드 사용'"
            :aria-pressed="ui.theme === 'dark'"
            @click="ui.toggleTheme"
          >
            <AppIcon :name="ui.theme === 'light' ? 'moon' : 'sun'" />
          </button>
        </div>
      </header>

      <main id="main-content" class="main-content" tabindex="-1">
        <RouterView />
      </main>
    </section>
  </div>
</template>
