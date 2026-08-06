import { expect } from "@wdio/globals";

import {
  deleteSchedule,
  expectEventAbsent,
  loadCalendarState,
  navigateToCalendar,
  syntheticSchedules,
} from "../calendar.fixture.mjs";

import { expectSyntheticCalendar } from "./calendar-synthetic.mjs";

export async function runCalendarPersistenceScenario(dashboardResult) {
  const { ids } = dashboardResult;
  const state = loadCalendarState();
  expect(ids.primaryCustomerId).toBe(state.customerId);
  expect(ids.duplicateConsultationId).toBe(state.duplicateConsultationId);
  expect(ids.maturityPolicyId).toBe(state.maturityPolicyId);
  expect(ids.recentConsultationId).toBe(state.recentConsultationId);

  await navigateToCalendar();
  await expectSyntheticCalendar(ids, state);

  await deleteSchedule(state.linkedScheduleId);
  await expectEventAbsent(
    state.linkedScheduleId,
    syntheticSchedules.linkedPersisted.title,
  );
}
