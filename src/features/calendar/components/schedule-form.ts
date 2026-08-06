import { parseScheduleInput } from "@/features/schedule/schemas/schedule-schema";
import type { ScheduleInput } from "@/features/schedule/types/schedule";
import { ScheduleValidationError } from "@/features/schedule/types/schedule-error";

export type ScheduleFieldName = keyof ScheduleInput;
export type ScheduleFieldErrors = Partial<Record<ScheduleFieldName, string>>;

export interface ScheduleFormValue extends ScheduleInput {
  readonly id: string;
}

export interface ScheduleFormState {
  title: string;
  scheduledOn: string;
  scheduledTime: string;
  memo: string;
  customerId: string;
  isCompleted: boolean;
}

export function createScheduleFormState(): ScheduleFormState {
  return {
    title: "",
    scheduledOn: "",
    scheduledTime: "",
    memo: "",
    customerId: "",
    isCompleted: false,
  };
}

export function resetScheduleForm(
  form: ScheduleFormState,
  schedule: ScheduleFormValue | null | undefined,
  defaultDate: string,
  errors: ScheduleFieldErrors,
): void {
  form.title = schedule?.title ?? "";
  form.scheduledOn = schedule?.scheduledOn ?? defaultDate;
  form.scheduledTime = schedule?.scheduledTime ?? "";
  form.memo = schedule?.memo ?? "";
  form.customerId = schedule?.customerId ?? "";
  form.isCompleted = schedule?.isCompleted ?? false;
  for (const field of Object.keys(errors) as ScheduleFieldName[]) {
    delete errors[field];
  }
}

export function scheduleInputFromForm(
  form: ScheduleFormState,
  errors: ScheduleFieldErrors,
): ScheduleInput | undefined {
  try {
    return parseScheduleInput({
      title: form.title,
      scheduledOn: form.scheduledOn,
      scheduledTime: form.scheduledTime || null,
      memo: form.memo || null,
      customerId: form.customerId || null,
      isCompleted: form.isCompleted,
    });
  } catch (error) {
    if (!(error instanceof ScheduleValidationError)) throw error;
    for (const field of Object.keys(errors) as ScheduleFieldName[]) {
      delete errors[field];
    }
    for (const issue of error.issues) {
      if (issue.field in form) {
        errors[issue.field as ScheduleFieldName] = issue.message;
      }
    }
    return undefined;
  }
}
