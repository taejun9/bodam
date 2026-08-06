import { customerApplication } from "@/app/composition/customer";
import { ConsultationApplication } from "@/features/consultation/application/consultation-application";
import { createConsultationRepository } from "@/features/consultation/repositories/consultation-repository-factory";

export const consultationApplication = new ConsultationApplication(
  createConsultationRepository(),
  customerApplication,
);
