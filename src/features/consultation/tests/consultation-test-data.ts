import type { Customer } from "@/features/customer/types/customer";

import type { Consultation, ConsultationInput } from "../types/consultation";

export const CONSULTATION_IDS = [
  "81000000-0000-4000-8000-000000000001",
  "81000000-0000-4000-8000-000000000002",
  "81000000-0000-4000-8000-000000000003",
] as const;
export const CUSTOMER_IDS = [
  "82000000-0000-4000-8000-000000000001",
  "82000000-0000-4000-8000-000000000002",
] as const;
export const TEST_TIMESTAMP = "2026-08-06T01:02:03.000Z";

export const consultationInput = (
  consultedAt = TEST_TIMESTAMP,
): ConsultationInput => ({
  consultedAt,
  content: "합성 상담 내용",
  nextContactOn: "2026-08-20",
  result: "합성 결과",
});

export const consultation = (
  id: string,
  customerId = CUSTOMER_IDS[0],
  consultedAt = TEST_TIMESTAMP,
): Consultation => ({
  id,
  customerId,
  ...consultationInput(consultedAt),
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});

export const customer = (id = CUSTOMER_IDS[0]): Customer => ({
  id,
  name: "합성 고객",
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: TEST_TIMESTAMP,
  updatedAt: TEST_TIMESTAMP,
});
