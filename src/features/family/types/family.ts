export interface FamilyInput {
  readonly name: string;
}

export interface Family extends FamilyInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FamilyMembershipInput {
  readonly customerId: string;
  readonly relationshipName: string | null;
}

export interface FamilyMembershipUpdateInput {
  readonly relationshipName: string | null;
}

export interface FamilyMembership extends FamilyMembershipInput {
  readonly id: string;
  readonly familyId: string;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface FamilySummary {
  readonly family: Family;
  readonly memberCount: number;
  readonly totalMonthlyPremiumWon: bigint;
}

export interface FamilyMemberView {
  readonly membershipId: string;
  readonly customerId: string;
  readonly customerName: string;
  readonly relationshipName: string | null;
  readonly totalMonthlyPremiumWon: bigint;
  readonly includedPolicyCount: number;
}

export interface FamilyDetail {
  readonly family: Family;
  readonly members: readonly FamilyMemberView[];
  readonly totalMonthlyPremiumWon: bigint;
}

export interface FamilyCustomerOption {
  readonly id: string;
  readonly name: string;
}
