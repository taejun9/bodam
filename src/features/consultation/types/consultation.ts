export interface ConsultationInput {
  readonly consultedAt: string;
  readonly content: string | null;
  readonly nextContactOn: string | null;
  readonly result: string | null;
}

export interface Consultation extends ConsultationInput {
  readonly id: string;
  readonly customerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface ConsultationDeleteResult {
  readonly id: string;
}
