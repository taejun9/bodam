import { customerApplication } from "@/app/composition/customer";
import { ScheduleApplication } from "@/features/schedule/application/schedule-application";
import { createScheduleRepository } from "@/features/schedule/repositories/schedule-repository-factory";

export const scheduleApplication = new ScheduleApplication(
  createScheduleRepository(),
  customerApplication,
);
