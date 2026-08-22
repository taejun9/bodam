import { ref } from "vue";

import { scheduleApplication } from "@/app/composition/schedule";
import type { CalendarScheduleDetail } from "@/features/calendar/types/calendar";
import type { ScheduleInput } from "@/features/schedule/types/schedule";
import {
  ScheduleValidationError,
  scheduleSafeMessage,
} from "@/features/schedule/types/schedule-error";

import type {
  ScheduleFieldErrors,
  ScheduleFieldName,
} from "../components/schedule-form";

interface CalendarScheduleActionOptions {
  selectedDate: () => string;
  selectDate: (date: string) => Promise<void>;
  reload: () => Promise<void>;
  showNotice: (message: string) => void;
  focusAfterDelete: () => Promise<void>;
}

export function useCalendarScheduleActions(options: CalendarScheduleActionOptions) {
  const formOpen = ref(false);
  const selectedSchedule = ref<CalendarScheduleDetail>();
  const submitting = ref(false);
  const formErrors = ref<ScheduleFieldErrors>({});
  const formSubmitError = ref<string>();
  const deleteOpen = ref(false);
  const deletingSchedule = ref<CalendarScheduleDetail>();
  const deleting = ref(false);
  const deleteError = ref<string>();
  const completingId = ref<string>();

  function createSchedule(): void {
    selectedSchedule.value = undefined;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function editSchedule(schedule: CalendarScheduleDetail): void {
    selectedSchedule.value = schedule;
    formErrors.value = {};
    formSubmitError.value = undefined;
    formOpen.value = true;
  }

  function clearFormError(field: ScheduleFieldName): void {
    const errors = { ...formErrors.value };
    delete errors[field];
    formErrors.value = errors;
  }

  function closeForm(): void {
    if (!submitting.value) formOpen.value = false;
  }

  async function saveSchedule(input: ScheduleInput): Promise<void> {
    const selected = selectedSchedule.value;
    submitting.value = true;
    formErrors.value = {};
    formSubmitError.value = undefined;
    try {
      const saved = selected
        ? await scheduleApplication.update(selected.id, input)
        : await scheduleApplication.create(input);
      formOpen.value = false;
      options.showNotice(selected ? "일정을 저장했습니다." : "새 일정을 저장했습니다.");
      if (saved.scheduledOn !== options.selectedDate()) {
        await options.selectDate(saved.scheduledOn);
      }
      await options.reload();
    } catch (error) {
      if (error instanceof ScheduleValidationError) {
        const errors: ScheduleFieldErrors = {};
        for (const issue of error.issues) {
          if (
            issue.field === "title" || issue.field === "scheduledOn" ||
            issue.field === "scheduledTime" || issue.field === "memo" ||
            issue.field === "customerId" || issue.field === "isCompleted"
          ) {
            errors[issue.field] = issue.message;
          }
        }
        formErrors.value = errors;
        if (Object.keys(errors).length === 0) formSubmitError.value = error.message;
      } else {
        formSubmitError.value = scheduleSafeMessage(error);
      }
    } finally {
      submitting.value = false;
    }
  }

  async function setCompleted(
    schedule: CalendarScheduleDetail,
    isCompleted: boolean,
  ): Promise<void> {
    completingId.value = schedule.id;
    try {
      await scheduleApplication.setCompleted(schedule.id, isCompleted);
      options.showNotice(isCompleted ? "일정을 완료했습니다." : "일정 완료를 되돌렸습니다.");
      await options.reload();
    } catch (error) {
      options.showNotice(scheduleSafeMessage(error));
    } finally {
      completingId.value = undefined;
    }
  }

  function requestDelete(schedule: CalendarScheduleDetail): void {
    deletingSchedule.value = schedule;
    deleteError.value = undefined;
    deleteOpen.value = true;
  }

  function closeDelete(): void {
    if (!deleting.value) deleteOpen.value = false;
  }

  async function confirmDelete(): Promise<void> {
    const schedule = deletingSchedule.value;
    if (!schedule) return;
    deleting.value = true;
    deleteError.value = undefined;
    try {
      await scheduleApplication.remove(schedule.id);
      deleteOpen.value = false;
      options.showNotice("일정을 기본 달력에서 삭제했습니다.");
      await options.reload();
      await options.focusAfterDelete();
    } catch (error) {
      deleteError.value = scheduleSafeMessage(error);
    } finally {
      deleting.value = false;
    }
  }

  return {
    formOpen,
    selectedSchedule,
    submitting,
    formErrors,
    formSubmitError,
    deleteOpen,
    deletingSchedule,
    deleting,
    deleteError,
    completingId,
    createSchedule,
    editSchedule,
    clearFormError,
    closeForm,
    saveSchedule,
    setCompleted,
    requestDelete,
    closeDelete,
    confirmDelete,
  };
}
