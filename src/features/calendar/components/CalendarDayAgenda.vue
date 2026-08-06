<script setup lang="ts">
import { computed } from "vue";
import { RouterLink } from "vue-router";

import type {
  CalendarDay,
  CalendarEvent,
  CalendarScheduleDetail,
} from "@/features/calendar/types/calendar";
import AppButton from "@/shared/components/AppButton.vue";

import {
  calendarDateLabel,
  calendarEventDateTime,
  calendarEventKindLabel,
  calendarEventTimeLabel,
} from "./calendar-display";

const props = defineProps<{
  day: CalendarDay;
  schedules: readonly CalendarScheduleDetail[];
  completingId?: string | undefined;
}>();

const emit = defineEmits<{
  create: [];
  edit: [schedule: CalendarScheduleDetail];
  complete: [schedule: CalendarScheduleDetail, completed: boolean];
  remove: [schedule: CalendarScheduleDetail];
}>();

const schedulesById = computed(
  () => new Map(props.schedules.map((schedule) => [schedule.id, schedule])),
);

function scheduleFor(event: CalendarEvent): CalendarScheduleDetail | undefined {
  return event.kind === "schedule" ? schedulesById.value.get(event.sourceId) : undefined;
}
</script>

<template>
  <section class="calendar-agenda surface" aria-labelledby="calendar-agenda-title">
    <header>
      <div>
        <span>SELECTED DAY</span>
        <h3 id="calendar-agenda-title">
          <time :datetime="day.date">{{ calendarDateLabel(day.date) }}</time>
        </h3>
        <p>{{ day.events.length > 0 ? `등록된 항목 ${day.events.length}개` : "등록된 항목이 없습니다." }}</p>
      </div>
      <AppButton variant="primary" data-testid="agenda-create-schedule" @click="emit('create')">
        이 날짜에 일정 등록
      </AppButton>
    </header>

    <div v-if="day.events.length === 0" class="calendar-agenda-empty">
      <span aria-hidden="true">○</span>
      <strong>비어 있는 날짜입니다</strong>
      <p>필요한 할 일을 일정으로 남길 수 있습니다.</p>
    </div>

    <ol v-else class="calendar-agenda-list">
      <li
        v-for="event in day.events"
        :key="event.id"
        class="calendar-agenda-item"
        :class="[`is-${event.kind}`, { 'is-completed': event.isCompleted }]"
        :data-event-id="event.id"
        :data-event-kind="event.kind"
      >
        <div class="calendar-agenda-time">
          <time :datetime="calendarEventDateTime(event)">{{ calendarEventTimeLabel(event) }}</time>
          <span>{{ calendarEventKindLabel(event.kind) }}</span>
        </div>
        <div class="calendar-agenda-copy">
          <RouterLink v-if="event.kind !== 'schedule' && event.customerId" :to="`/customers/${event.customerId}`">
            {{ event.title }}
          </RouterLink>
          <button
            v-else-if="scheduleFor(event)"
            class="calendar-schedule-title"
            type="button"
            @click="emit('edit', scheduleFor(event)!)"
          >{{ event.title }}</button>
          <strong v-else>{{ event.title }}</strong>
          <p data-testid="calendar-event-reason">{{ event.reason }}</p>
          <p v-if="scheduleFor(event)?.memo" class="calendar-schedule-memo">
            {{ scheduleFor(event)?.memo }}
          </p>
          <RouterLink
            v-if="event.kind === 'schedule' && event.customerId"
            class="calendar-customer-link"
            :to="`/customers/${event.customerId}`"
          >연결 고객 · {{ event.customerName }}</RouterLink>
        </div>
        <div v-if="scheduleFor(event)" class="calendar-agenda-actions">
          <AppButton
            variant="ghost"
            :loading="completingId === event.sourceId"
            @click="emit('complete', scheduleFor(event)!, !event.isCompleted)"
          >{{ event.isCompleted ? "완료 되돌리기" : "완료" }}</AppButton>
          <AppButton variant="ghost" @click="emit('edit', scheduleFor(event)!)">수정</AppButton>
          <AppButton variant="ghost" @click="emit('remove', scheduleFor(event)!)">삭제</AppButton>
        </div>
      </li>
    </ol>
  </section>
</template>
