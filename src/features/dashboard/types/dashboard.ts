export const DASHBOARD_MAX_ITEMS = 10;

export interface DashboardQuery {
  readonly referenceDate: string;
  readonly referenceInstant: string;
  readonly timeZone: string;
  readonly limit: number;
}

export interface DashboardPolicyFact {
  readonly policyId: string;
  readonly insurer: string;
  readonly productName: string;
  readonly maturesOn: string | null;
  readonly isIncluded: boolean;
}

export interface DashboardConsultationFact {
  readonly consultationId: string;
  readonly consultedAt: string;
  readonly nextContactOn: string | null;
}

export type DashboardCoverageStatus =
  | "insufficient"
  | "adequate"
  | "excessive"
  | "unconfigured";

export interface DashboardCoverageAssessmentFact {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountWon: bigint;
  readonly status: DashboardCoverageStatus;
  readonly adequateMinWon: bigint | null;
}

export interface DashboardCustomerFacts {
  readonly customerId: string;
  readonly customerName: string;
  readonly isManaged: boolean;
  readonly birthDate: string | null;
  readonly totalMonthlyPremiumWon: bigint;
  readonly policies: readonly DashboardPolicyFact[];
  readonly consultations: readonly DashboardConsultationFact[];
  readonly coverageAssessments: readonly DashboardCoverageAssessmentFact[];
}

export interface DashboardFamilyFacts {
  readonly familyId: string;
  readonly familyName: string;
  readonly memberCount: number;
  readonly totalMonthlyPremiumWon: bigint;
}

export interface DashboardSources {
  readonly customers: readonly DashboardCustomerFacts[];
  readonly families: readonly DashboardFamilyFacts[];
}

export interface DashboardCard<T> {
  readonly totalCount: number;
  readonly isTruncated: boolean;
  readonly items: readonly T[];
}

export type UpcomingBucket = "0-30" | "31-60" | "61-90";

export interface TodayContactItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly consultationId: string;
  readonly consultedAt: string;
  readonly nextContactOn: string;
  readonly daysOverdue: number;
  readonly reason: string;
}

export interface InsuranceAgeItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly birthDate: string;
  readonly eventOn: string;
  readonly daysUntil: number;
  readonly bucket: UpcomingBucket;
  readonly insuranceAgeYears: number;
  readonly reason: string;
}

export interface MaturityItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly policyId: string;
  readonly insurer: string;
  readonly productName: string;
  readonly eventOn: string;
  readonly daysUntil: number;
  readonly bucket: UpcomingBucket;
  readonly reason: string;
}

export interface PremiumTopItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly amountWon: bigint;
  readonly reason: string;
}

export interface FamilyPremiumItem {
  readonly familyId: string;
  readonly familyName: string;
  readonly memberCount: number;
  readonly amountWon: bigint;
  readonly reason: string;
}

export interface InsufficientCoverageCategoryItem {
  readonly categoryId: string;
  readonly categoryName: string;
  readonly amountWon: bigint;
  readonly adequateMinWon: bigint;
  readonly shortfallWon: bigint;
}

export interface CoverageInsufficientItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly insufficientCategoryCount: number;
  readonly categories: readonly InsufficientCoverageCategoryItem[];
  readonly reason: string;
}

export interface RecentConsultationItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly consultationId: string;
  readonly consultedAt: string;
  readonly consultedOn: string;
  readonly daysAgo: number;
  readonly reason: string;
}

export interface UnconsultedItem {
  readonly customerId: string;
  readonly customerName: string;
  readonly latestConsultationId: string | null;
  readonly latestConsultedAt: string | null;
  readonly latestConsultedOn: string | null;
  readonly daysSince: number | null;
  readonly reason: string;
}

export interface DashboardReadModel {
  readonly referenceDate: string;
  readonly referenceInstant: string;
  readonly timeZone: string;
  readonly todayContact: DashboardCard<TodayContactItem>;
  readonly insuranceAge: DashboardCard<InsuranceAgeItem>;
  readonly maturity: DashboardCard<MaturityItem>;
  readonly premiumTop: DashboardCard<PremiumTopItem>;
  readonly familyPremium: DashboardCard<FamilyPremiumItem>;
  readonly coverageInsufficient: DashboardCard<CoverageInsufficientItem>;
  readonly recentConsultation: DashboardCard<RecentConsultationItem>;
  readonly unconsulted: DashboardCard<UnconsultedItem>;
}
