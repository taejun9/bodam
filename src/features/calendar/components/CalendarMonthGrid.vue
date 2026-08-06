<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import { RouterLink } from "vue-router";

import type { CalendarDay, CalendarEvent } from "@/features/calendar/types/calendar";

import {
  calendarDayButtonLabel,
  calendarEventKindLabel,
  calendarEventTimeLabel,
} from "./calendar-display";

const props = defineProps<{
  days: readonly CalendarDay[];
  selectedDate: string;
  currentDate: string;
}>();

const emit = defineEmits<{
  select: [date: string];
  navigateDay: [days: number];
  changeMonth: [months: number];
  editSchedule: [id: string];
}>();

const grid = ref<HTMLElement>();
const leadingBlanks = computed(() => props.days[0]?.weekday ?? 0);
const calendarRows = computed(() => {
  const cells: Array<CalendarDay | null> = [
    ...Array.from({ length: leadingBlanks.value }, () => null),
    ...props.days,
  ];
  while (cells.length < 42) cells.push(null);
  return Array.from({ length: 6 }, (_, index) =>
    cells.slice(index * 7, index * 7 + 7)
  );
});
let focusAfterNavigation = false;

function visibleEvents(day: CalendarDay): readonly CalendarEvent[] {
  return day.events.slice(0, 3);
}

function navigateDay(event: KeyboardEvent, days: number): void {
  event.preventDefault();
  focusAfterNavigation = true;
  emit("navigateDay", days);
}

function handleDateKey(event: KeyboardEvent, day: CalendarDay): void {
  if (event.key === "ArrowLeft") navigateDay(event, -1);
  else if (event.key === "ArrowRight") navigateDay(event, 1);
  else if (event.key === "ArrowUp") navigateDay(event, -7);
  else if (event.key === "ArrowDown") navigateDay(event, 7);
  else if (event.key === "Home") navigateDay(event, -day.weekday);
  else if (event.key === "End") navigateDay(event, 6 - day.weekday);
  else if (event.key === "PageUp" || event.key === "PageDown") {
    event.preventDefault();
    focusAfterNavigation = true;
    emit("changeMonth", event.key === "PageUp" ? -1 : 1);
  }
}

watch(
  () => [props.selectedDate, props.days] as const,
  async ([date]) => {
    if (!focusAfterNavigation) return;
    await nextTick();
    const target = grid.value
      ?.querySelector<HTMLElement>(`[data-calendar-date='${date}'] .calendar-date-button`);
    if (!target) return;
    focusAfterNavigation = false;
    target.focus();
  },
);
</script>

<template>
  <section class="calendar-grid-shell surface" aria-labelledby="calendar-grid-title">
    <h3 id="calendar-grid-title" class="sr-only">월간 일정</h3>
    <div ref="grid" class="calendar-grid" role="grid" aria-labelledby="calendar-grid-title">
      <div class="calendar-weekdays" role="row">
        <span v-for="weekday in ['일', '월', '화', '수', '목', '금', '토']" :key="weekday" role="columnheader">
          {{ weekday }}
        </span>
      </div>
      <div
        v-for="(week, weekIndex) in calendarRows"
        :key="`week-${weekIndex}`"
        class="calendar-week"
        role="row"
      >
        <template v-for="(day, dayIndex) in week" :key="day?.date ?? `blank-${weekIndex}-${dayIndex}`">
          <span
            v-if="day === null"
            class="calendar-day is-blank"
            role="gridcell"
            aria-disabled="true"
          />
          <article
            v-else
            class="calendar-day"
            :class="{ 'is-selected': day.date === selectedDate, 'is-today': day.date === currentDate }"
            role="gridcell"
            :aria-selected="day.date === selectedDate"
            :data-calendar-date="day.date"
            :data-event-count="day.events.length"
          >
        <button
          class="calendar-date-button"
          type="button"
          :aria-label="calendarDayButtonLabel(day.date, day.weekday, day.events.length)"
          :aria-current="day.date === currentDate ? 'date' : undefined"
          :tabindex="day.date === selectedDate ? 0 : -1"
          @click="emit('select', day.date)"
          @keydown="handleDateKey($event, day)"
        >
          <time :datetime="day.date">{{ Number(day.date.slice(-2)) }}</time>
          <span v-if="day.date === currentDate">오늘</span>
          <b v-if="day.events.length > 0">{{ day.events.length }}</b>
        </button>
        <div class="calendar-cell-events">
          <template v-for="event in visibleEvents(day)" :key="event.id">
            <button
              v-if="event.kind === 'schedule'"
              class="calendar-event-chip"
              :class="[`is-${event.kind}`, { 'is-completed': event.isCompleted }]"
              type="button"
              tabindex="-1"
              :data-event-id="event.id"
              :data-event-kind="event.kind"
              @click="emit('editSchedule', event.sourceId)"
            >
              <time :datetime="event.scheduledTime ? `${event.eventOn}T${event.scheduledTime}:00` : event.eventOn">
                {{ calendarEventTimeLabel(event) }}
              </time>
              <span>{{ event.title }}</span>
            </button>
            <RouterLink
              v-else-if="event.customerId"
              class="calendar-event-chip"
              :class="`is-${event.kind}`"
              :to="`/customers/${event.customerId}`"
              tabindex="-1"
              :data-event-id="event.id"
              :data-event-kind="event.kind"
            >
              <span class="sr-only">{{ calendarEventKindLabel(event.kind) }}:</span>
              <time :datetime="event.scheduledTime ? `${event.eventOn}T${event.scheduledTime}:00` : event.eventOn">
                {{ calendarEventTimeLabel(event) }}
              </time>
              <span>{{ event.title }}</span>
            </RouterLink>
          </template>
          <button
            v-if="day.events.length > 3"
            class="calendar-more-events"
            type="button"
            tabindex="-1"
            @click="emit('select', day.date)"
          >+{{ day.events.length - 3 }}개 더 보기</button>
        </div>
          </article>
        </template>
      </div>
    </div>
  </section>
</template>
