import type { Consultation } from "@/features/consultation/types/consultation";
import type { Customer } from "@/features/customer/types/customer";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";
import { calendarMonthRange } from "@/shared/calendar-date";

import {
  buildCalendarMonthReadModel,
  validateCalendarMonthQuery,
} from "../services/calendar-read-model";
import type {
  CalendarMonthQuery,
  CalendarMonthReadModel,
  CalendarScheduleDetail,
  CalendarScheduleRange,
} from "../types/calendar";
import { CalendarApplicationError } from "../types/calendar-error";
import type { CalendarCustomerSource } from "../types/calendar-source";

export interface CalendarCustomerReader {
  list(search?: string): Promise<readonly Customer[]>;
}

export interface CalendarInsuranceReader {
  list(customerId: string): Promise<readonly InsurancePolicy[]>;
}

export interface CalendarConsultationReader {
  list(customerId: string): Promise<readonly Consultation[]>;
}

export interface CalendarScheduleReader {
  list(query: CalendarScheduleRange): Promise<readonly CalendarScheduleDetail[]>;
}

export class CalendarApplication {
  constructor(
    private readonly customers: CalendarCustomerReader,
    private readonly insurance: CalendarInsuranceReader,
    private readonly consultations: CalendarConsultationReader,
    private readonly schedules: CalendarScheduleReader,
  ) {}

  async loadMonth(query: CalendarMonthQuery): Promise<CalendarMonthReadModel> {
    try {
      const validated = validateCalendarMonthQuery(query);
      const range = calendarMonthRange(validated.month);
      const [customers, schedules] = await Promise.all([
        this.customers.list(),
        this.schedules.list(range),
      ]);
      const customerSources = await Promise.all(
        customers.map((customer) => this.customerSource(customer)),
      );
      return buildCalendarMonthReadModel({
        customers: customerSources,
        schedules,
      }, validated);
    } catch {
      throw new CalendarApplicationError();
    }
  }

  private async customerSource(customer: Customer): Promise<CalendarCustomerSource> {
    const [policies, consultations] = await Promise.all([
      this.insurance.list(customer.id),
      this.consultations.list(customer.id),
    ]);
    return {
      customerId: customer.id,
      customerName: customer.name,
      birthDate: customer.birthDate,
      policies: policies.map((policy) => ({
        policyId: policy.id,
        insurer: policy.insurer,
        productName: policy.productName,
        maturesOn: policy.maturesOn,
      })),
      consultations: consultations.map((consultation) => ({
        consultationId: consultation.id,
        consultedAt: consultation.consultedAt,
        nextContactOn: consultation.nextContactOn,
      })),
    };
  }
}
