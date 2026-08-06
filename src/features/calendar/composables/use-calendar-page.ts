import {
  computed,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";

import { calendarApplication } from "@/app/composition/calendar";
import {
  calendarReferenceDate,
  hasCalendarReferenceDateOverride,
  millisecondsUntilNextLocalMidnight,
  resolvedLocalTimeZone,
} from "@/features/calendar/components/calendar-runtime";
import type { CalendarMonthReadModel } from "@/features/calendar/types/calendar";
import { calendarSafeMessage } from "@/features/calendar/types/calendar-error";
import {
  CALENDAR_VIEW_MAX_DATE,
  CALENDAR_VIEW_MIN_DATE,
  addCalendarDays,
  addCalendarMonthsClamped,
  parseCalendarDate,
  parseCalendarMonth,
} from "@/shared/calendar-date";

interface CalendarPageOptions {
  contentHeading: Ref<HTMLElement | undefined>;
}

const CALENDAR_VIEW_MIN_MONTH = CALENDAR_VIEW_MIN_DATE.slice(0, 7);
const CALENDAR_VIEW_MAX_MONTH = CALENDAR_VIEW_MAX_DATE.slice(0, 7);

function clampToCalendarView(date: string): string {
  if (date < CALENDAR_VIEW_MIN_DATE) return CALENDAR_VIEW_MIN_DATE;
  if (date > CALENDAR_VIEW_MAX_DATE) return CALENDAR_VIEW_MAX_DATE;
  return date;
}

function queryString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

export function useCalendarPage(options: CalendarPageOptions) {
  const route = useRoute();
  const router = useRouter();
  const model = ref<CalendarMonthReadModel>();
  const selectedDate = ref("");
  const currentDate = ref("");
  const timeZone = ref("");
  const initialLoading = ref(true);
  const refreshing = ref(false);
  const retrying = ref(false);
  const error = ref<string>();

  let requestNumber = 0;
  let midnightTimer: ReturnType<typeof setTimeout> | undefined;
  let documentWasHidden = document.visibilityState === "hidden";

  const selectedDay = computed(() =>
    model.value?.days.find((day) => day.date === selectedDate.value),
  );
  const canMovePreviousMonth = computed(
    () => selectedDate.value.slice(0, 7) > CALENDAR_VIEW_MIN_MONTH,
  );
  const canMoveNextMonth = computed(
    () => selectedDate.value.slice(0, 7) < CALENDAR_VIEW_MAX_MONTH,
  );

  function resolveLocalContext(): { date: string; zone: string } {
    const zone = resolvedLocalTimeZone();
    const date = calendarReferenceDate(zone);
    currentDate.value = date;
    timeZone.value = zone;
    return { date, zone };
  }

  function canonicalRouteState(): { month: string; date: string; zone: string } {
    const local = resolveLocalContext();
    const requestedMonth = queryString(route.query.month);
    const requestedDate = queryString(route.query.date);
    try {
      if (!requestedMonth || !requestedDate) throw new RangeError("missing calendar route");
      parseCalendarMonth(requestedMonth);
      parseCalendarDate(requestedDate);
      if (requestedDate.slice(0, 7) !== requestedMonth) {
        throw new RangeError("calendar date is outside month");
      }
      if (
        requestedDate < CALENDAR_VIEW_MIN_DATE ||
        requestedDate > CALENDAR_VIEW_MAX_DATE
      ) {
        throw new RangeError("calendar date is outside the supported view");
      }
      return { month: requestedMonth, date: requestedDate, zone: local.zone };
    } catch {
      const date = clampToCalendarView(local.date);
      return { month: date.slice(0, 7), date, zone: local.zone };
    }
  }

  async function loadCalendar(mode: "initial" | "refresh" | "retry" = "refresh") {
    const state = canonicalRouteState();
    selectedDate.value = state.date;
    if (route.query.month !== state.month || route.query.date !== state.date) {
      await router.replace({ name: "calendar", query: { month: state.month, date: state.date } });
      return;
    }

    const currentRequest = ++requestNumber;
    if (mode === "initial") initialLoading.value = true;
    else if (mode === "retry") retrying.value = true;
    else refreshing.value = true;
    if (mode !== "retry") error.value = undefined;

    try {
      const result = await calendarApplication.loadMonth({
        month: state.month,
        timeZone: state.zone,
      });
      if (currentRequest !== requestNumber) return;
      model.value = result;
      error.value = undefined;
      if (mode === "retry") {
        await nextTick();
        options.contentHeading.value?.focus();
      }
    } catch (loadError) {
      if (currentRequest !== requestNumber) return;
      model.value = undefined;
      error.value = calendarSafeMessage(loadError);
    } finally {
      if (currentRequest === requestNumber) {
        initialLoading.value = false;
        refreshing.value = false;
        retrying.value = false;
      }
    }
  }

  async function selectDate(date: string): Promise<void> {
    parseCalendarDate(date);
    const supportedDate = clampToCalendarView(date);
    await router.push({
      name: "calendar",
      query: { month: supportedDate.slice(0, 7), date: supportedDate },
    });
  }

  async function moveByDays(days: number): Promise<void> {
    let target: string;
    try {
      target = addCalendarDays(selectedDate.value, days);
    } catch {
      target = days < 0 ? CALENDAR_VIEW_MIN_DATE : CALENDAR_VIEW_MAX_DATE;
    }
    await selectDate(target);
  }

  async function moveByMonths(months: number): Promise<void> {
    let target: string;
    try {
      target = addCalendarMonthsClamped(selectedDate.value, months);
    } catch {
      target = months < 0 ? CALENDAR_VIEW_MIN_DATE : CALENDAR_VIEW_MAX_DATE;
    }
    await selectDate(target);
  }

  async function goToday(): Promise<void> {
    await selectDate(resolveLocalContext().date);
  }

  function scheduleMidnightRefresh(): void {
    if (midnightTimer) clearTimeout(midnightTimer);
    if (hasCalendarReferenceDateOverride()) return;
    midnightTimer = setTimeout(() => {
      scheduleMidnightRefresh();
      void loadCalendar();
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
    void loadCalendar();
  }

  function handleFocus(): void {
    scheduleMidnightRefresh();
    void loadCalendar();
  }

  watch(
    () => [route.query.month, route.query.date],
    () => void loadCalendar(initialLoading.value ? "initial" : "refresh"),
    { immediate: true },
  );

  onMounted(() => {
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    scheduleMidnightRefresh();
  });

  onBeforeUnmount(() => {
    requestNumber += 1;
    document.removeEventListener("visibilitychange", handleVisibilityChange);
    window.removeEventListener("focus", handleFocus);
    if (midnightTimer) clearTimeout(midnightTimer);
  });

  return {
    model,
    selectedDate,
    selectedDay,
    canMovePreviousMonth,
    canMoveNextMonth,
    currentDate,
    timeZone,
    initialLoading,
    refreshing,
    retrying,
    error,
    loadCalendar,
    selectDate,
    moveByDays,
    moveByMonths,
    goToday,
  };
}
