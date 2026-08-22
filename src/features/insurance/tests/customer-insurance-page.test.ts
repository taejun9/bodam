// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { createMemoryHistory, createRouter } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "@/features/customer/types/customer";
import { InsuranceRepositoryError } from "@/features/insurance/types/insurance-error";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

const applicationMocks = vi.hoisted(() => ({
  customerList: vi.fn(),
  policyList: vi.fn(),
  remove: vi.fn(),
  total: vi.fn((policies: readonly InsurancePolicy[]) =>
    policies.reduce(
      (sum, policy) => sum + (policy.isIncluded ? policy.monthlyPremiumWon : 0n),
      0n,
    ),
  ),
}));

vi.mock("@/app/composition/customer", () => ({
  customerApplication: { list: applicationMocks.customerList },
}));

vi.mock("@/app/composition/insurance", () => ({
  insuranceApplication: {
    list: applicationMocks.policyList,
    remove: applicationMocks.remove,
    total: applicationMocks.total,
  },
}));

import CustomerInsurancePage from "../pages/CustomerInsurancePage.vue";

const customerAId = "11111111-1111-4111-8111-111111111111";
const customerBId = "22222222-2222-4222-8222-222222222222";

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

const deleteDialogStub = defineComponent({
  props: ["open"],
  emits: ["confirm"],
  template: `
    <button v-if="open" data-testid="confirm-policy-delete" @click="$emit('confirm')">
      확인
    </button>
  `,
});

function customer(id: string, name: string): Customer {
  return {
    id,
    name,
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
}

function policy(): InsurancePolicy {
  return {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    customerId: customerAId,
    insurer: "합성보험사 A",
    productName: "합성상품 A",
    joinedOn: null,
    coverageTerm: null,
    paymentTerm: null,
    monthlyPremiumWon: 120_000n,
    disclosurePlan: null,
    maturesOn: null,
    renewable: false,
    status: null,
    isIncluded: true,
    createdAt: "2026-08-06T01:02:03.000Z",
    updatedAt: "2026-08-06T01:02:03.000Z",
  };
}

describe("CustomerInsurancePage route isolation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => document.body.replaceChildren());

  it("clears the previous customer and policies when the next route fails", async () => {
    applicationMocks.customerList
      .mockResolvedValueOnce([customer(customerAId, "합성고객 A")])
      .mockResolvedValueOnce([customer(customerBId, "합성고객 B")]);
    applicationMocks.policyList
      .mockResolvedValueOnce([policy()])
      .mockRejectedValueOnce(
        new InsuranceRepositoryError(
          "활성 고객을 찾을 수 없습니다.",
          "customer_not_found",
        ),
      );

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/customers", component: { template: "<div />" } },
        { path: "/customers/:customerId", component: CustomerInsurancePage },
      ],
    });
    await router.push(`/customers/${customerAId}`);
    const wrapper = mount(CustomerInsurancePage, {
      global: {
        plugins: [router],
        stubs: {
          AppIcon: true,
          InsurancePolicyDeleteDialog: true,
          InsurancePolicyFormDialog: true,
          InsurancePolicyTable: {
            props: ["policies"],
            template: "<div>{{ policies.map((item) => item.productName).join(',') }}</div>",
          },
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("합성고객 A");
    expect(wrapper.text()).toContain("합성상품 A");
    expect(wrapper.get("[data-testid='premium-total']").text()).toBe("120,000원");

    await router.push(`/customers/${customerBId}`);
    await flushPromises();

    expect(wrapper.text()).toContain("고객 상세를 열지 못했습니다");
    expect(wrapper.text()).toContain("활성 고객을 찾을 수 없습니다.");
    expect(wrapper.text()).not.toContain("합성고객 A");
    expect(wrapper.text()).not.toContain("합성상품 A");
    expect(wrapper.find("[data-testid='premium-total']").exists()).toBe(false);
    expect(wrapper.find("[data-testid='customer-detail-retry']").exists()).toBe(false);
  });

  it("retries a transient initial load once and focuses the loaded customer heading", async () => {
    const retryCustomers = deferred<Customer[]>();
    const retryPolicies = deferred<InsurancePolicy[]>();
    applicationMocks.customerList
      .mockRejectedValueOnce(new Error("private-customer-load-marker"))
      .mockReturnValueOnce(retryCustomers.promise);
    applicationMocks.policyList
      .mockResolvedValueOnce([])
      .mockReturnValueOnce(retryPolicies.promise);

    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/customers", component: { template: "<div />" } },
        { path: "/customers/:customerId", component: CustomerInsurancePage },
      ],
    });
    await router.push(`/customers/${customerAId}`);
    await router.isReady();
    const wrapper = mount(CustomerInsurancePage, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          CustomerConsultationSection: true,
          CustomerCoverageSection: true,
          InsurancePolicyDeleteDialog: true,
          InsurancePolicyFormDialog: true,
          InsurancePolicyTable: true,
          PolicyCoverageDialog: true,
        },
      },
    });
    await flushPromises();

    const retry = wrapper.get("[data-testid='customer-detail-retry']");
    expect(wrapper.text()).not.toContain("private-customer-load-marker");
    (retry.element as HTMLElement).focus();
    await retry.trigger("click");
    expect(retry.attributes("disabled")).toBeDefined();
    await retry.trigger("click");
    expect(applicationMocks.customerList).toHaveBeenCalledTimes(2);
    expect(applicationMocks.policyList).toHaveBeenCalledTimes(2);

    retryCustomers.resolve([customer(customerAId, "합성고객 A")]);
    retryPolicies.resolve([policy()]);
    await flushPromises();

    expect(wrapper.find("[data-testid='customer-detail-retry']").exists()).toBe(false);
    expect(document.activeElement?.id).toBe("insurance-section-title");
    wrapper.unmount();
  });

  it("keeps active-customer not-found as a non-retryable list exit", async () => {
    applicationMocks.customerList.mockResolvedValue([customer(customerBId, "합성고객 B")]);
    applicationMocks.policyList.mockResolvedValue([]);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/customers", component: { template: "<div />" } },
        { path: "/customers/:customerId", component: CustomerInsurancePage },
      ],
    });
    await router.push(`/customers/${customerAId}`);
    const wrapper = mount(CustomerInsurancePage, {
      global: {
        plugins: [router],
        stubs: {
          CustomerConsultationSection: true,
          CustomerCoverageSection: true,
          InsurancePolicyDeleteDialog: true,
          InsurancePolicyFormDialog: true,
          InsurancePolicyTable: true,
          PolicyCoverageDialog: true,
        },
      },
    });
    await flushPromises();

    expect(wrapper.text()).toContain("활성 고객을 찾을 수 없습니다.");
    expect(wrapper.find("[data-testid='customer-detail-retry']").exists()).toBe(false);
    expect(wrapper.get("a.state-link[href='/customers']").text())
      .toContain("고객 목록으로 돌아가기");
  });

  it("focuses the stable policy create action after a soft delete reload finishes", async () => {
    const reload = deferred<InsurancePolicy[]>();
    applicationMocks.customerList.mockResolvedValue([customer(customerAId, "합성고객 A")]);
    applicationMocks.policyList
      .mockResolvedValueOnce([policy()])
      .mockReturnValueOnce(reload.promise);
    applicationMocks.remove.mockResolvedValue(undefined);
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: "/customers", component: { template: "<div />" } },
        { path: "/customers/:customerId", component: CustomerInsurancePage },
      ],
    });
    await router.push(`/customers/${customerAId}`);
    const wrapper = mount(CustomerInsurancePage, {
      attachTo: document.body,
      global: {
        plugins: [router],
        stubs: {
          CustomerConsultationSection: true,
          CustomerCoverageSection: true,
          InsurancePolicyDeleteDialog: deleteDialogStub,
          InsurancePolicyFormDialog: true,
          PolicyCoverageDialog: true,
        },
      },
    });
    await flushPromises();

    const remove = wrapper.findAll<HTMLElement>("[data-testid='delete-policy']")[0]!;
    remove.element.focus();
    await remove.trigger("click");
    await wrapper.get("[data-testid='confirm-policy-delete']").trigger("click");
    await flushPromises();

    const create = wrapper.get("[data-testid='create-policy']");
    expect(applicationMocks.remove).toHaveBeenCalledWith(policy().id);
    expect(applicationMocks.policyList).toHaveBeenCalledTimes(2);
    expect(document.activeElement).not.toBe(create.element);

    reload.resolve([]);
    await flushPromises();
    expect(document.activeElement).toBe(create.element);
    wrapper.unmount();
  });
});
