import { consultationApplication } from "@/app/composition/consultation";
import { customerApplication } from "@/app/composition/customer";
import { insuranceApplication } from "@/app/composition/insurance";
import { scheduleApplication } from "@/app/composition/schedule";
import { CalendarApplication } from "@/features/calendar/application/calendar-application";

export const calendarApplication = new CalendarApplication(
  customerApplication,
  insuranceApplication,
  consultationApplication,
  scheduleApplication,
);
