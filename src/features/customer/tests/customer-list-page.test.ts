// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "@/features/customer/types/customer";

const applicationMocks = vi.hoisted(() => ({
  list: vi.fn(),
  remove: vi.fn(),
}));

vi.mock("@/app/composition/customer", () => ({
  customerApplication: applicationMocks,
}));

import CustomerListPage from "../pages/CustomerListPage.vue";

interface Deferred<T> {
  promise: Promise<T>;
  resolve(value: T): void;
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

const syntheticCustomer: Customer = {
  id: "11111111-1111-4111-8111-111111111111",
  name: "합성 고객",
  birthDate: null,
  gender: null,
  phone: null,
  address: null,
  memo: null,
  status: null,
  isManaged: true,
  createdAt: "2026-08-06T01:02:03.000Z",
  updatedAt: "2026-08-06T01:02:03.000Z",
};

const customerTableStub = defineComponent({
  props: ["customers"],
  emits: ["remove"],
  template: `
    <button
      v-if="customers[0]"
      data-testid="remove-customer"
      @click="$emit('remove', customers[0])"
    >제외</button>
  `,
});

const deleteDialogStub = defineComponent({
  props: ["open"],
  emits: ["confirm"],
  template: `
    <button v-if="open" data-testid="confirm-customer-delete" @click="$emit('confirm')">
      확인
    </button>
  `,
});

describe("CustomerListPage focus recovery", () => {
  beforeEach(() => vi.clearAllMocks());
  afterEach(() => document.body.replaceChildren());

  it("focuses the stable create action after a soft delete reload finishes", async () => {
    const reload = deferred<Customer[]>();
    applicationMocks.list
      .mockResolvedValueOnce([syntheticCustomer])
      .mockReturnValueOnce(reload.promise);
    applicationMocks.remove.mockResolvedValue(undefined);

    const wrapper = mount(CustomerListPage, {
      attachTo: document.body,
      global: {
        stubs: {
          CustomerTable: customerTableStub,
          CustomerDeleteDialog: deleteDialogStub,
          CustomerFormDialog: true,
        },
      },
    });
    await flushPromises();

    const remove = wrapper.get<HTMLElement>("[data-testid='remove-customer']");
    remove.element.focus();
    await remove.trigger("click");
    await wrapper.get("[data-testid='confirm-customer-delete']").trigger("click");
    await flushPromises();

    const create = wrapper.get("[data-testid='create-customer']");
    expect(applicationMocks.remove).toHaveBeenCalledWith(syntheticCustomer.id);
    expect(applicationMocks.list).toHaveBeenCalledTimes(2);
    expect(document.activeElement).not.toBe(create.element);

    reload.resolve([]);
    await flushPromises();
    expect(document.activeElement).toBe(create.element);

    wrapper.unmount();
  });
});
