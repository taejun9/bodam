<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";

import { dashboardApplication } from "@/app/composition/dashboard";
import { dateOnlyLabel } from "@/features/dashboard/components/dashboard-display";
import {
  dashboardReferenceDate,
  dashboardReferenceInstant,
  hasDashboardReferenceDateOverride,
  millisecondsUntilNextLocalMidnight,
  resolvedLocalTimeZone,
} from "@/features/dashboard/components/dashboard-runtime";
import DashboardCards from "@/features/dashboard/components/DashboardCards.vue";
import {
  DASHBOARD_MAX_ITEMS,
  type DashboardReadModel,
} from "@/features/dashboard/types/dashboard";
import { dashboardSafeMessage } from "@/features/dashboard/types/dashboard-error";

const model = ref<DashboardReadModel>();
const referenceDate = ref<string>();
const timeZone = ref<string>();
const initialLoading = ref(true);
const refreshing = ref(false);
const retrying = ref(false);
const error = ref<string>();
const contentHeading = ref<HTMLElement>();

let requestNumber = 0;
let midnightTimer: ReturnType<typeof setTimeout> | undefined;
let documentWasHidden = document.visibilityState === "hidden";

function query() {
  const now = new Date();
  const resolvedTimeZone = resolvedLocalTimeZone();
  const resolvedReferenceDate = dashboardReferenceDate(resolvedTimeZone, now);
  const resolvedReferenceInstant = dashboardReferenceInstant(now);
  referenceDate.value = resolvedReferenceDate;
  timeZone.value = resolvedTimeZone;
  return {
    referenceDate: resolvedReferenceDate,
    referenceInstant: resolvedReferenceInstant,
    timeZone: resolvedTimeZone,
    limit: DASHBOARD_MAX_ITEMS,
  };
}

async function loadDashboard(
  mode: "initial" | "refresh" | "retry" = "refresh",
): Promise<void> {
  const currentRequest = ++requestNumber;
  if (mode === "initial") initialLoading.value = true;
  else if (mode === "retry") retrying.value = true;
  else refreshing.value = true;
  if (mode !== "retry") error.value = undefined;

  try {
    const result = await dashboardApplication.load(query());
    if (currentRequest !== requestNumber) return;
    model.value = result;
    referenceDate.value = result.referenceDate;
    timeZone.value = result.timeZone;
    error.value = undefined;
    if (mode === "retry") {
      await nextTick();
      contentHeading.value?.focus();
    }
  } catch (loadError) {
    if (currentRequest !== requestNumber) return;
    model.value = undefined;
    error.value = dashboardSafeMessage(loadError);
  } finally {
    if (currentRequest === requestNumber) {
      initialLoading.value = false;
      refreshing.value = false;
      retrying.value = false;
    }
  }
}

function scheduleMidnightRefresh(): void {
  if (midnightTimer) clearTimeout(midnightTimer);
  if (hasDashboardReferenceDateOverride()) return;
  midnightTimer = setTimeout(() => {
    scheduleMidnightRefresh();
    void loadDashboard();
  }, millisecondsUntilNextLocalMidnight());
}

function handleVisibilityChange(): void {
  if (document.visibilityState === "hidden") {
    documentWasHidden = true;
    return;
  }
  if (!documentWasHidden) return;
  documentWasHidden = false;
  scheduleMidnightRefresh();
  void loadDashboard();
}

function handleFocus(): void {
  scheduleMidnightRefresh();
  void loadDashboard();
}

onMounted(() => {
  document.addEventListener("visibilitychange", handleVisibilityChange);
  window.addEventListener("focus", handleFocus);
  scheduleMidnightRefresh();
  void loadDashboard("initial");
});

onBeforeUnmount(() => {
  requestNumber += 1;
  document.removeEventListener("visibilitychange", handleVisibilityChange);
  window.removeEventListener("focus", handleFocus);
  if (midnightTimer) clearTimeout(midnightTimer);
});
</script>

<template>
  <section
    class="dashboard-page"
    data-testid="dashboard-page"
    aria-labelledby="dashboard-content-title"
    :aria-busy="initialLoading || refreshing || retrying"
  >
    <header class="dashboard-page-header">
      <div>
        <span class="dashboard-eyebrow">TODAY</span>
        <h2 id="dashboard-content-title" ref="contentHeading" tabindex="-1">
          오늘의 업무 요약
        </h2>
        <p>저장된 최신 정보를 기준으로 우선 확인할 업무를 모았습니다.</p>
      </div>
      <span class="dashboard-reference">
        화면 기준일
        <time
          v-if="referenceDate"
          data-testid="dashboard-reference-date"
          :datetime="referenceDate"
        >{{ dateOnlyLabel(referenceDate) }}</time>
        <span v-else>확인 중</span>
        <small v-if="timeZone">{{ timeZone }}</small>
      </span>
    </header>

    <span v-if="refreshing && model" class="dashboard-refresh-state" role="status">
      최신 정보로 다시 계산하는 중
    </span>

    <section v-if="initialLoading" class="dashboard-state surface" aria-live="polite">
      <span class="dashboard-refresh-state">대시보드를 불러오는 중</span>
      <strong>오늘의 업무를 계산하고 있습니다</strong>
      <span>이 PC에 저장된 고객·계약·상담 정보를 확인합니다.</span>
    </section>

    <section v-else-if="error" class="dashboard-state surface" role="alert">
      <span class="dashboard-state-symbol" aria-hidden="true">!</span>
      <strong>대시보드를 열지 못했습니다</strong>
      <span>{{ error }}</span>
      <button
        type="button"
        data-testid="dashboard-retry"
        :disabled="retrying"
        @click="loadDashboard('retry')"
      >{{ retrying ? "다시 불러오는 중" : "다시 시도" }}</button>
    </section>

    <DashboardCards v-else-if="model" :model="model" />
  </section>
</template>
