import { expect } from "@wdio/globals";

import {
  calendarGridEvent,
  calendarGridEventOrder,
  expectEventAbsent,
  expectScheduleDetails,
  syntheticSchedules,
  visibleCalendarKinds,
} from "../calendar.fixture.mjs";
import { syntheticConsultations } from "../consultation.fixture.mjs";
import { syntheticCustomer } from "../customer.fixture.mjs";
import { syntheticPolicies } from "../policy.fixture.mjs";

const customerLink = (customerId) => `#/customers/${customerId}`;

function expectedSourceEvents(ids, scheduleId) {
  return [
    {
      date: syntheticConsultations.updated.nextContactOn,
      dateTime: syntheticConsultations.updated.nextContactOn,
      id: `consultation:${ids.recentConsultationId}:next-contact`,
      kind: "next-contact",
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    },
    {
      date: syntheticConsultations.duplicate.consultedAtLocal.slice(0, 10),
      dateTime: `${syntheticConsultations.duplicate.consultedAtLocal}:00`,
      id: `consultation:${ids.duplicateConsultationId}:consulted`,
      kind: "consultation",
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    },
    {
      date: syntheticConsultations.updated.consultedAtLocal.slice(0, 10),
      dateTime: `${syntheticConsultations.updated.consultedAtLocal}:00`,
      id: `consultation:${ids.recentConsultationId}:consulted`,
      kind: "consultation",
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    },
    {
      date: syntheticSchedules.linkedPersisted.scheduledOn,
      dateTime: `${syntheticSchedules.linkedPersisted.scheduledOn}` +
        `T${syntheticSchedules.linkedPersisted.scheduledTime}:00`,
      id: `schedule:${scheduleId}`,
      kind: "schedule",
      text: [syntheticSchedules.linkedPersisted.title],
    },
    {
      date: "2026-08-15",
      dateTime: "2026-08-15",
      id: `customer:${ids.primaryCustomerId}:insurance-age:2026-08-15`,
      kind: "insurance-age",
      text: [syntheticCustomer.updatedName],
      href: customerLink(ids.primaryCustomerId),
    },
    {
      date: syntheticPolicies.excluded.maturesOn,
      dateTime: syntheticPolicies.excluded.maturesOn,
      id: `policy:${ids.maturityPolicyId}:maturity`,
      kind: "policy-maturity",
      text: [syntheticCustomer.updatedName, syntheticPolicies.excluded.productName],
      href: customerLink(ids.primaryCustomerId),
    },
  ];
}

export async function expectSyntheticCalendar(ids, state) {
  expect(await visibleCalendarKinds()).toEqual([
    "consultation",
    "insurance-age",
    "next-contact",
    "policy-maturity",
    "schedule",
  ]);

  for (const expected of expectedSourceEvents(ids, state.linkedScheduleId)) {
    const event = await calendarGridEvent(expected.date, expected.id);
    expect(await event.getAttribute("data-event-id")).toBe(expected.id);
    expect(await event.getAttribute("data-event-kind")).toBe(expected.kind);
    expect(await event.$("time").getAttribute("datetime")).toBe(expected.dateTime);
    const text = await event.getText();
    for (const token of expected.text) expect(text).toContain(token);
    if (expected.href) {
      expect(await event.getAttribute("href")).toContain(expected.href);
    }
  }

  expect(await calendarGridEventOrder("2026-08-05")).toEqual([
    {
      dateTime: `${syntheticConsultations.duplicate.consultedAtLocal}:00`,
      id: `consultation:${ids.duplicateConsultationId}:consulted`,
    },
    {
      dateTime: `${syntheticConsultations.updated.consultedAtLocal}:00`,
      id: `consultation:${ids.recentConsultationId}:consulted`,
    },
  ]);

  await expectScheduleDetails(
    state.linkedScheduleId,
    syntheticSchedules.linkedPersisted,
    ids.primaryCustomerId,
  );
  await expectEventAbsent(state.removedScheduleId, syntheticSchedules.removed.title);
}
