/* global describe, it */

import { expect } from "@wdio/globals";

import {
  customerRows,
  removeCustomer,
  searchCustomers,
  syntheticCustomer,
  waitForNativeApp,
  waitForOneCustomer,
} from "../customer.fixture.mjs";

describe("BODAM native customer restart flow", () => {
  it("persists across an app process restart and soft-deletes from the active list", async () => {
    await waitForNativeApp();
    await searchCustomers(syntheticCustomer.updatedName);

    const row = await waitForOneCustomer(syntheticCustomer.updatedName);
    const rowText = await row.getText();
    expect(rowText).toContain(syntheticCustomer.phone);
    expect(rowText).toContain(syntheticCustomer.status);

    await removeCustomer(row);
    await searchCustomers(syntheticCustomer.seed);
    expect((await customerRows()).length).toBe(0);
  });
});
