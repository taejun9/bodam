// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Customer } from "@/features/customer/types/customer";
import { InsuranceRepositoryError } from "@/features/insurance/types/insurance-error";
import type { InsurancePolicy } from "@/features/insurance/types/insurance-policy";

const applicationMocks = vi.hoisted(() => ({
  customerList: vi.fn(),
  policyList: vi.fn(),
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
    total: applicationMocks.total,
  },
}));

import CustomerInsurancePage from "../pages/CustomerInsurancePage.vue";

const customerAId = "11111111-1111-4111-8111-111111111111";
const customerBId = "22222222-2222-4222-8222-222222222222";

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
  });
});
