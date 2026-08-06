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

function card<T>(sortedItems: readonly T[], itemLimit: number): DashboardCard<T> {
  const items = sortedItems.slice(0, itemLimit);
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
  const {
    referenceDate,
    referenceInstant,
    timeZone,
    recentConsultationDays,
    unconsultedDays,
    dashboardItemLimit,
  } = validatedQuery;

  return {
    referenceDate,
    referenceInstant,
    timeZone,
    recentConsultationDays,
    unconsultedDays,
    dashboardItemLimit,
    todayContact: card(
      buildTodayContactItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
      ),
      dashboardItemLimit,
    ),
    insuranceAge: card(
      buildInsuranceAgeItems(managedCustomers, referenceDate),
      dashboardItemLimit,
    ),
    maturity: card(
      buildMaturityItems(managedCustomers, referenceDate),
      dashboardItemLimit,
    ),
    premiumTop: card(buildPremiumTopItems(managedCustomers), dashboardItemLimit),
    familyPremium: card(
      buildFamilyPremiumItems(sources.families),
      dashboardItemLimit,
    ),
    coverageInsufficient: card(
      buildCoverageInsufficientItems(managedCustomers),
      dashboardItemLimit,
    ),
    recentConsultation: card(
      buildRecentConsultationItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
        recentConsultationDays,
      ),
      dashboardItemLimit,
    ),
    unconsulted: card(
      buildUnconsultedItems(
        managedCustomers,
        referenceDate,
        referenceInstant,
        timeZone,
        unconsultedDays,
      ),
      dashboardItemLimit,
    ),
  };
}
