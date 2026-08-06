import {
  completeSchedule,
  createSchedule,
  expectUnlinkedAllDaySchedule,
  navigateToCalendar,
  saveCalendarState,
  syntheticSchedules,
  updateSchedule,
  deleteSchedule,
} from "../calendar.fixture.mjs";

import { expectSyntheticCalendar } from "./calendar-synthetic.mjs";

export async function runCalendarWriteScenario(dashboardResult) {
  const { ids } = dashboardResult;
  await navigateToCalendar();

  const linkedScheduleId = await createSchedule(
    syntheticSchedules.linkedDraft,
    ids.primaryCustomerId,
  );
  await updateSchedule(
    linkedScheduleId,
    syntheticSchedules.linkedUpdated,
    ids.primaryCustomerId,
  );
  await completeSchedule(linkedScheduleId);

  const removedScheduleId = await createSchedule(syntheticSchedules.removed);
  await expectUnlinkedAllDaySchedule(removedScheduleId, syntheticSchedules.removed);
  await deleteSchedule(removedScheduleId);

  const state = {
    linkedScheduleId,
    removedScheduleId,
    customerId: ids.primaryCustomerId,
    duplicateConsultationId: ids.duplicateConsultationId,
    maturityPolicyId: ids.maturityPolicyId,
    recentConsultationId: ids.recentConsultationId,
  };
  await expectSyntheticCalendar(ids, state);
  saveCalendarState(state);
  return state;
}
