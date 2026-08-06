import {
  parseConsultationInput,
} from "@/features/consultation/schemas/consultation-schema";
import {
  currentLocalDateTimeValue,
  localDateTimeToUtcTimestamp,
  utcTimestampToLocalDateTime,
} from "@/features/consultation/services/consultation-datetime";
import type {
  Consultation,
  ConsultationInput,
} from "@/features/consultation/types/consultation";
import { ConsultationValidationError } from "@/features/consultation/types/consultation-error";

export type ConsultationFieldName = keyof ConsultationInput;
export type ConsultationFieldErrors = Partial<
  Record<ConsultationFieldName, string>
>;

export interface ConsultationFormState {
  consultedAt: string;
  content: string;
  nextContactOn: string;
  result: string;
}

export function createConsultationFormState(
  consultation?: Consultation | null,
  now = new Date(),
): ConsultationFormState {
  return {
    consultedAt: consultation
      ? utcTimestampToLocalDateTime(consultation.consultedAt)
      : currentLocalDateTimeValue(now).slice(0, 16),
    content: consultation?.content ?? "",
    nextContactOn: consultation?.nextContactOn ?? "",
    result: consultation?.result ?? "",
  };
}

export function resetConsultationForm(
  form: ConsultationFormState,
  consultation: Consultation | null | undefined,
  errors: ConsultationFieldErrors,
): void {
  Object.assign(form, createConsultationFormState(consultation));
  for (const field of Object.keys(errors)) {
    delete errors[field as ConsultationFieldName];
  }
}

export function consultationInputFromForm(
  form: ConsultationFormState,
  errors: ConsultationFieldErrors,
): ConsultationInput | undefined {
  for (const field of Object.keys(errors)) {
    delete errors[field as ConsultationFieldName];
  }

  try {
    return parseConsultationInput({
      consultedAt: localDateTimeToUtcTimestamp(form.consultedAt),
      content: form.content,
      nextContactOn: form.nextContactOn,
      result: form.result,
    });
  } catch (error) {
    if (!(error instanceof ConsultationValidationError)) throw error;
    for (const issue of error.issues) {
      if (
        issue.field === "consultedAt" ||
        issue.field === "content" ||
        issue.field === "nextContactOn" ||
        issue.field === "result"
      ) {
        errors[issue.field] = issue.message;
      }
    }
    return undefined;
  }
}
