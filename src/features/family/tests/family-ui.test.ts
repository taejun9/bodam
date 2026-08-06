// @vitest-environment happy-dom

import { flushPromises, mount } from "@vue/test-utils";
import { createMemoryHistory, createRouter } from "vue-router";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  FamilyDetail,
  FamilySummary,
} from "@/features/family/types/family";

const applicationMocks = vi.hoisted(() => ({
  list: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  detail: vi.fn(),
  availableCustomers: vi.fn(),
  addMembership: vi.fn(),
  updateMembership: vi.fn(),
  removeMembership: vi.fn(),
}));

vi.mock("@/app/composition/family", () => ({
  familyApplication: applicationMocks,
}));

import CustomerDeleteDialog from "@/features/customer/components/CustomerDeleteDialog.vue";
import FamilyDeleteDialog from "../components/FamilyDeleteDialog.vue";
import FamilyFormDialog from "../components/FamilyFormDialog.vue";
import FamilyMembersDialog from "../components/FamilyMembersDialog.vue";
import FamilyTable from "../components/FamilyTable.vue";
import FamilyListPage from "../pages/FamilyListPage.vue";

const timestamp = "2026-08-06T01:02:03.000Z";
const familyIds = [
  "40000000-0000-4000-8000-000000000001",
  "40000000-0000-4000-8000-000000000002",
  "40000000-0000-4000-8000-000000000003",
] as const;
const customerIds = [
  "60000000-0000-4000-8000-000000000001",
  "60000000-0000-4000-8000-000000000002",
  "60000000-0000-4000-8000-000000000003",
] as const;
const membershipIds = [
  "50000000-0000-4000-8000-000000000001",
  "50000000-0000-4000-8000-000000000002",
] as const;

function summary(id: string, name: string, total = 0n): FamilySummary {
  return {
    family: { id, name, createdAt: timestamp, updatedAt: timestamp },
    memberCount: 2,
    totalMonthlyPremiumWon: total,
  };
}

const selectedFamily = summary(familyIds[0], "합성 가족", 90_000n);
const detail: FamilyDetail = {
  family: selectedFamily.family,
  members: [
    {
      membershipId: membershipIds[0],
      customerId: customerIds[0],
      customerName: "같은 고객",
      relationshipName: "본인",
      totalMonthlyPremiumWon: 50_000n,
      includedPolicyCount: 1,
    },
    {
      membershipId: membershipIds[1],
      customerId: customerIds[1],
      customerName: "같은 고객",
      relationshipName: null,
      totalMonthlyPremiumWon: 40_000n,
      includedPolicyCount: 2,
    },
  ],
  totalMonthlyPremiumWon: 90_000n,
};

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

async function testRouter() {
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [
      { path: "/", component: { template: "<div />" } },
      { path: "/customers", component: { template: "<div />" } },
      {
        path: "/customers/:customerId",
        name: "customer-detail",
        component: { template: "<div />" },
      },
    ],
  });
  await router.push("/");
  return router;
}

describe("family UI contracts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    applicationMocks.list.mockResolvedValue([selectedFamily]);
    applicationMocks.create.mockResolvedValue(selectedFamily.family);
    applicationMocks.update.mockResolvedValue(selectedFamily.family);
    applicationMocks.remove.mockResolvedValue(undefined);
    applicationMocks.detail.mockResolvedValue(detail);
    applicationMocks.availableCustomers.mockResolvedValue([
      { id: customerIds[2], name: "같은 고객" },
    ]);
    applicationMocks.addMembership.mockResolvedValue({});
    applicationMocks.updateMembership.mockResolvedValue({});
    applicationMocks.removeMembership.mockResolvedValue(undefined);
  });

  it("disambiguates duplicate family names and formats bigint totals", () => {
    const families = [
      summary(familyIds[0], "같은 가족", 9_007_199_254_740_993n),
      summary(familyIds[1], "같은 가족", 2n),
      summary(familyIds[2], "고유 가족", 3n),
    ];
    const wrapper = mount(FamilyTable, { props: { families } });
    const rows = wrapper.findAll("tbody [data-testid='family-row']");

    expect(rows[0]?.text()).toContain(`가족 ID ${familyIds[0]}`);
    expect(rows[1]?.text()).toContain(`가족 ID ${familyIds[1]}`);
    expect(rows[2]?.text()).not.toContain(`가족 ID ${familyIds[2]}`);
    expect(rows[0]?.text()).toContain("9,007,199,254,740,993원");
    expect(rows[0]?.get("[data-testid='manage-family-members']").attributes("aria-label"))
      .toContain(`가족 ID ${familyIds[0]}`);
  });

  it("links duplicate members and focuses the loaded member action", async () => {
    const wrapper = mount(FamilyMembersDialog, {
      props: { open: true, family: selectedFamily },
      attachTo: document.body,
      global: { plugins: [await testRouter()], stubs: { AppDialog: dialogStub } },
    });
    await flushPromises();

    const rows = wrapper.findAll("[data-testid='family-member-row']");
    expect(rows).toHaveLength(2);
    expect(rows[0]?.text()).toContain(`고객 ID ${customerIds[0]}`);
    expect(rows[1]?.text()).toContain("관계명 미입력");
    expect(rows[0]?.get("[data-testid='family-member-customer-link']").attributes("href"))
      .toBe(`/customers/${customerIds[0]}`);
    expect(rows[0]?.get("[data-testid='delete-family-member']").attributes("aria-label"))
      .toContain(`고객 ID ${customerIds[0]}`);
    expect(wrapper.get("[data-testid='family-member-total']").text()).toBe("90,000원");
    expect(document.activeElement).toBe(wrapper.get("[data-testid='add-family-member']").element);
    wrapper.unmount();
  });

  it("explains why no additional active customer can be added", async () => {
    applicationMocks.availableCustomers.mockResolvedValue([]);
    const wrapper = mount(FamilyMembersDialog, {
      props: { open: true, family: selectedFamily },
      global: { plugins: [await testRouter()], stubs: { AppDialog: dialogStub } },
    });
    await flushPromises();

    const addButton = wrapper.get("[data-testid='add-family-member']");
    expect(addButton.attributes("disabled")).toBeDefined();
    expect(addButton.attributes("aria-describedby")).toBe("family-member-availability-note");
    expect(wrapper.get("#family-member-availability-note").text())
      .toContain("모든 활성 고객이 이미 연결되어 있거나");
  });

  it("adds, updates, and removes memberships through the application contract", async () => {
    const wrapper = mount(FamilyMembersDialog, {
      props: { open: true, family: selectedFamily },
      global: { plugins: [await testRouter()], stubs: { AppDialog: dialogStub } },
    });
    await flushPromises();

    await wrapper.get("[data-testid='add-family-member']").trigger("click");
    const optionLabels = wrapper.findAll("option").map((option) => option.text());
    expect(optionLabels).toContain(`같은 고객 · 고객 ID ${customerIds[2]}`);
    expect(wrapper.text()).toContain("법적 관계·성별·대표자를 뜻하지 않습니다");
    expect(wrapper.text()).toContain("주민등록번호·보험사 로그인 정보·병력·진단·치료 내용");
    await wrapper.get("select[name='customerId']").setValue(customerIds[2]);
    await wrapper.get("input[name='relationshipName']").setValue("   ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(applicationMocks.addMembership).toHaveBeenCalledWith(familyIds[0], {
      customerId: customerIds[2],
      relationshipName: null,
    });

    await wrapper.findAll("[data-testid='edit-family-member']")[0]?.trigger("click");
    await wrapper.get("input[name='relationshipName']").setValue(" 자녀 ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(applicationMocks.updateMembership).toHaveBeenCalledWith(
      familyIds[0],
      membershipIds[0],
      { relationshipName: "자녀" },
    );

    await wrapper.findAll("[data-testid='delete-family-member']")[0]?.trigger("click");
    expect(wrapper.text()).toContain("고객과 보험계약 원본은 보존");
    await wrapper.get("[data-testid='family-member-delete'] .is-danger").trigger("click");
    await flushPromises();
    expect(applicationMocks.removeMembership)
      .toHaveBeenCalledWith(familyIds[0], membershipIds[0]);
  });

  it("explains sensitive-data and soft-deletion effects", () => {
    const familyForm = mount(FamilyFormDialog, {
      props: { open: true },
      global: { stubs: { AppDialog: dialogStub } },
    });
    expect(familyForm.text()).toContain("주민등록번호·보험사 로그인 정보·병력·진단·치료 내용");

    const familyDelete = mount(FamilyDeleteDialog, {
      props: { open: true, family: selectedFamily },
      global: { stubs: { AppDialog: dialogStub } },
    });
    expect(familyDelete.text()).toContain("구성원 연결 기록과 고객·보험계약");
    expect(familyDelete.text()).toContain("이 PC에 보존");

    const customerDelete = mount(CustomerDeleteDialog, {
      props: {
        open: true,
        customer: {
          id: customerIds[0],
          name: "합성 고객",
          birthDate: null,
          gender: null,
          phone: null,
          address: null,
          memo: null,
          status: null,
          isManaged: true,
          createdAt: timestamp,
          updatedAt: timestamp,
        },
      },
      global: { stubs: { AppDialog: dialogStub } },
    });
    expect(customerDelete.text()).toContain("가족 구성원 연결은 보존");
    expect(customerDelete.text()).toContain("가족 구성원 목록과 보험료 합계에서는 숨겨집니다");
  });

  it("moves focus to the surviving search field after deleting a family", async () => {
    applicationMocks.list
      .mockResolvedValueOnce([selectedFamily])
      .mockResolvedValueOnce([]);
    const wrapper = mount(FamilyListPage, {
      attachTo: document.body,
      global: { plugins: [await testRouter()], stubs: { AppDialog: dialogStub } },
    });
    await flushPromises();

    const deleteButtons = wrapper.findAll("[data-testid='delete-family']");
    expect(deleteButtons).toHaveLength(2);
    await deleteButtons[0]?.trigger("click");
    await wrapper.get("[data-testid='confirm-delete-family']").trigger("click");
    await flushPromises();

    expect(applicationMocks.remove).toHaveBeenCalledWith(familyIds[0]);
    expect(document.activeElement).toBe(wrapper.get("input[aria-label='가족 검색']").element);
    wrapper.unmount();
  });
});
