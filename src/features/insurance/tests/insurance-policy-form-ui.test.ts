// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import InsurancePolicyFormDialog from "../components/InsurancePolicyFormDialog.vue";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

describe("Insurance policy form accessibility", () => {
  it("connects every visible validation error to its control", () => {
    const errors = {
      insurer: "합성 보험사 오류",
      productName: "합성 상품명 오류",
      monthlyPremiumWon: "합성 월보험료 오류",
      joinedOn: "합성 가입일 오류",
      maturesOn: "합성 만기일 오류",
      coverageTerm: "합성 보험기간 오류",
      paymentTerm: "합성 납입기간 오류",
      disclosurePlan: "합성 고지플랜 오류",
      status: "합성 계약 상태 오류",
    };
    const wrapper = mount(InsurancePolicyFormDialog, {
      props: { open: true, errors },
      global: { stubs: { AppDialog: dialogStub } },
    });

    const fields = [
      ["insurer", "insurance-policy-insurer-error"],
      ["productName", "insurance-policy-productName-error"],
      ["monthlyPremiumWon", "insurance-policy-monthlyPremiumWon-error"],
      ["joinedOn", "insurance-policy-joinedOn-error"],
      ["maturesOn", "insurance-policy-maturesOn-error"],
      ["coverageTerm", "insurance-policy-coverageTerm-error"],
      ["paymentTerm", "insurance-policy-paymentTerm-error"],
      ["disclosurePlan", "insurance-policy-disclosurePlan-error"],
      ["status", "insurance-policy-status-error"],
    ] as const;

    for (const [field, errorId] of fields) {
      const control = wrapper.get(`[name='${field}']`);
      expect(control.attributes("aria-invalid")).toBe("true");
      expect(control.attributes("aria-describedby")).toBe(errorId);
      expect(wrapper.get(`#${errorId}`).text()).toBe(errors[field]);
    }

    wrapper.unmount();
  });
});
