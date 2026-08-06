export interface InsurancePolicyInput {
  readonly insurer: string;
  readonly productName: string;
  readonly joinedOn: string | null;
  readonly coverageTerm: string | null;
  readonly paymentTerm: string | null;
  readonly monthlyPremiumWon: bigint;
  readonly disclosurePlan: string | null;
  readonly maturesOn: string | null;
  readonly renewable: boolean;
  readonly status: string | null;
  readonly isIncluded: boolean;
}

export interface InsurancePolicy extends InsurancePolicyInput {
  readonly id: string;
  readonly customerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InsurancePolicyWireInput {
  readonly insurer: string;
  readonly productName: string;
  readonly joinedOn: string | null;
  readonly coverageTerm: string | null;
  readonly paymentTerm: string | null;
  readonly monthlyPremiumWon: string;
  readonly disclosurePlan: string | null;
  readonly maturesOn: string | null;
  readonly renewable: boolean;
  readonly status: string | null;
  readonly isIncluded: boolean;
}

export interface InsurancePolicyWire extends InsurancePolicyWireInput {
  readonly id: string;
  readonly customerId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface InsurancePolicyDeleteResult {
  readonly id: string;
}
