import type {
  DashboardCard,
  DashboardQuery,
  DashboardReadModel,
  DashboardSources,
} from "../types/dashboard";
import {
  buildInsuranceAgeItems,
  buildMaturityItems,
  buildRecentConsultationItems,
  buildTodayContactItems,
  buildUnconsultedItems,
} from "./dashboard-customer-events";
import { validateDashboardQuery } from "./dashboard-date";
import {
  buildCoverageInsufficientItems,
  buildFamilyPremiumItems,
  buildPremiumTopItems,
} from "./dashboard-rankings";
import { validateDashboardSources } from "./dashboard-validation";

export { validateDashboardQuery } from "./dashboard-date";

function card<T>(sortedItems: readonly T[], limit: number): DashboardCard<T> {
  const items = sortedItems.slice(0, limit);
  return {
    totalCount: sortedItems.length,
    isTruncated: sortedItems.length > items.length,
    items,
  };
}

export function buildDashboardReadModel(
  sources: DashboardSources,
  query: DashboardQuery,
): DashboardReadModel {
  const validatedQuery = validateDashboardQuery(query);
  validateDashboardSources(sources, validatedQuery.timeZone);
  const managedCustomers = sources.customers.filter((customer) => customer.isManaged);
  const { referenceDate, referenceInstant, timeZone, limit } = validatedQuery;

  return {
    referenceDate,
    referenceInstant,
    timeZone,
    todayContact: card(
      buildTodayContactItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
      ),
      limit,
    ),
    insuranceAge: card(
      buildInsuranceAgeItems(managedCustomers, referenceDate),
      limit,
    ),
    maturity: card(buildMaturityItems(managedCustomers, referenceDate), limit),
    premiumTop: card(buildPremiumTopItems(managedCustomers), limit),
    familyPremium: card(buildFamilyPremiumItems(sources.families), limit),
    coverageInsufficient: card(
      buildCoverageInsufficientItems(managedCustomers),
      limit,
    ),
    recentConsultation: card(
      buildRecentConsultationItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
      ),
      limit,
    ),
    unconsulted: card(
      buildUnconsultedItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
      ),
      limit,
    ),
  };
}
