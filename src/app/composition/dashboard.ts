import { consultationApplication } from "@/app/composition/consultation";
import { coverageBenchmarkApplication } from "@/app/composition/coverage-benchmark";
import { coverageApplication } from "@/app/composition/coverage";
import { customerApplication } from "@/app/composition/customer";
import { familyApplication } from "@/app/composition/family";
import { insuranceApplication } from "@/app/composition/insurance";
import { DashboardApplication } from "@/features/dashboard/application/dashboard-application";

export const dashboardApplication = new DashboardApplication(
  customerApplication,
  insuranceApplication,
  familyApplication,
  coverageApplication,
  coverageBenchmarkApplication,
  consultationApplication,
);
