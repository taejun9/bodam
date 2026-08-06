import type { CalendarScheduleDetail } from "./calendar";

export interface CalendarPolicySource {
  readonly policyId: string;
  readonly insurer: string;
  readonly productName: string;
  readonly maturesOn: string | null;
}

export interface CalendarConsultationSource {
  readonly consultationId: string;
  readonly consultedAt: string;
  readonly nextContactOn: string | null;
}

export interface CalendarCustomerSource {
  readonly customerId: string;
  readonly customerName: string;
  readonly birthDate: string | null;
  readonly policies: readonly CalendarPolicySource[];
  readonly consultations: readonly CalendarConsultationSource[];
}

export interface CalendarSources {
  readonly customers: readonly CalendarCustomerSource[];
  readonly schedules: readonly CalendarScheduleDetail[];
}
