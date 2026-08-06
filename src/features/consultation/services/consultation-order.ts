import type { Consultation } from "../types/consultation";

export function sortConsultationsLatestFirst(
  consultations: readonly Consultation[],
): Consultation[] {
  return [...consultations].sort((left, right) =>
    right.consultedAt.localeCompare(left.consultedAt) ||
    left.id.localeCompare(right.id)
  );
}
