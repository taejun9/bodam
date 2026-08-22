<script setup lang="ts">
import { computed, nextTick, onBeforeUnmount, ref } from "vue";

import CalendarDayAgenda from "@/features/calendar/components/CalendarDayAgenda.vue";
import CalendarMonthGrid from "@/features/calendar/components/CalendarMonthGrid.vue";
import CalendarToolbar from "@/features/calendar/components/CalendarToolbar.vue";
import ScheduleDeleteDialog from "@/features/calendar/components/ScheduleDeleteDialog.vue";
import ScheduleFormDialog from "@/features/calendar/components/ScheduleFormDialog.vue";
import { calendarMonthLabel } from "@/features/calendar/components/calendar-display";
import { useCalendarPage } from "@/features/calendar/composables/use-calendar-page";
import { useCalendarScheduleActions } from "@/features/calendar/composables/use-calendar-schedule-actions";
import AppButton from "@/shared/components/AppButton.vue";

const pageElement = ref<HTMLElement>();
const contentHeading = ref<HTMLElement>();
const notice = ref<string>();
let noticeTimer: ReturnType<typeof setTimeout> | undefined;

const page = useCalendarPage({ contentHeading });

function showNotice(message: string): void {
  notice.value = message;
  if (noticeTimer) clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => {
    notice.value = undefined;
  }, 3500);
}

async function focusAfterScheduleDelete(): Promise<void> {
  await nextTick();
  const pageRoot = pageElement.value;
  const target = pageRoot?.querySelector<HTMLElement>(
    "[data-testid='agenda-create-schedule']",
  ) ?? pageRoot?.querySelector<HTMLElement>("[data-testid='calendar-retry']")
    ?? contentHeading.value;
  target?.focus();
}

const actions = useCalendarScheduleActions({
  selectedDate: () => page.selectedDate.value,
  selectDate: page.selectDate,
  reload: () => page.loadCalendar(),
  showNotice,
  focusAfterDelete: focusAfterScheduleDelete,
});

const monthLabel = computed(() =>
  page.model.value ? calendarMonthLabel(page.model.value.month) : "달력 불러오는 중",
);

function editScheduleById(id: string): void {
  const schedule = page.model.value?.schedules.find((candidate) => candidate.id === id);
  if (schedule) actions.editSchedule(schedule);
}

onBeforeUnmount(() => {
  if (noticeTimer) clearTimeout(noticeTimer);
});
</script>

<template>
  <section
    class="calendar-page"
    ref="pageElement"
    data-testid="calendar-page"
    aria-labelledby="calendar-content-title"
    :aria-busy="page.initialLoading.value || page.refreshing.value || page.retrying.value"
  >
    <header class="calendar-page-heading">
      <div>
        <span>MONTHLY WORKSPACE</span>
        <h2 id="calendar-content-title" ref="contentHeading" tabindex="-1">
          월간 업무 달력
        </h2>
        <p>상담·연락·상령·만기와 직접 등록한 일정을 한 날짜 흐름으로 확인합니다.</p>
      </div>
      <span class="calendar-local-note">
        <i aria-hidden="true" />
        날짜와 일정은 이 PC의 로컬 기준입니다
      </span>
    </header>

    <p v-if="notice" class="toast-notice" role="status">{{ notice }}</p>

    <section v-if="page.initialLoading.value" class="state-panel surface" aria-live="polite">
      <div class="large-spinner" aria-hidden="true" />
      <strong>월간 달력을 불러오는 중입니다</strong>
      <span>이 PC에 저장된 고객·계약·상담·일정을 날짜별로 계산합니다.</span>
    </section>

    <section v-else-if="page.error.value" class="state-panel surface" role="alert">
      <span class="state-symbol is-error" aria-hidden="true">!</span>
      <strong>달력을 열지 못했습니다</strong>
      <span>{{ page.error.value }}</span>
      <AppButton
        data-testid="calendar-retry"
        :loading="page.retrying.value"
        @click="page.loadCalendar('retry')"
      >다시 시도</AppButton>
    </section>

    <template v-else-if="page.model.value && page.selectedDay.value">
      <CalendarToolbar
        :month-label="monthLabel"
        :time-zone="page.timeZone.value"
        :refreshing="page.refreshing.value"
        :can-move-previous="page.canMovePreviousMonth.value"
        :can-move-next="page.canMoveNextMonth.value"
        @previous="page.moveByMonths(-1)"
        @next="page.moveByMonths(1)"
        @today="page.goToday()"
        @create="actions.createSchedule"
      />

      <div class="calendar-kind-legend" aria-label="달력 항목 종류">
        <span class="is-next-contact"><i />다음 연락</span>
        <span class="is-consultation"><i />상담</span>
        <span class="is-insurance-age"><i />상령</span>
        <span class="is-policy-maturity"><i />계약 만기</span>
        <span class="is-schedule"><i />사용자 일정</span>
      </div>

      <CalendarMonthGrid
        :days="page.model.value.days"
        :selected-date="page.selectedDate.value"
        :current-date="page.currentDate.value"
        @select="page.selectDate"
        @navigate-day="page.moveByDays"
        @change-month="page.moveByMonths"
        @edit-schedule="editScheduleById"
      />

      <CalendarDayAgenda
        :day="page.selectedDay.value"
        :schedules="page.model.value.schedules"
        :completing-id="actions.completingId.value"
        @create="actions.createSchedule"
        @edit="actions.editSchedule"
        @complete="actions.setCompleted"
        @remove="actions.requestDelete"
      />
    </template>

    <ScheduleFormDialog
      :open="actions.formOpen.value"
      :default-date="page.selectedDate.value"
      :customers="page.model.value?.customers ?? []"
      :schedule="actions.selectedSchedule.value"
      :submitting="actions.submitting.value"
      :errors="actions.formErrors.value"
      :submit-error="actions.formSubmitError.value"
      @close="actions.closeForm"
      @submit="actions.saveSchedule"
      @clear-error="actions.clearFormError"
    />

    <ScheduleDeleteDialog
      :open="actions.deleteOpen.value"
      :title="actions.deletingSchedule.value?.title"
      :deleting="actions.deleting.value"
      :error="actions.deleteError.value"
      @close="actions.closeDelete"
      @confirm="actions.confirmDelete"
    />
  </section>
</template>
