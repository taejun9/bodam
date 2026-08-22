// @vitest-environment happy-dom

import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";

import CustomerFormDialog from "../components/CustomerFormDialog.vue";

const dialogStub = {
  name: "AppDialog",
  props: ["open"],
  template: "<section v-if='open'><slot /></section>",
};

describe("Customer form accessibility", () => {
  it("connects every visible validation error and keeps the memo privacy hint", () => {
    const errors = {
      name: "합성 이름 오류",
      birthDate: "합성 생년월일 오류",
      gender: "합성 성별 오류",
      phone: "합성 연락처 오류",
      status: "합성 상태 오류",
      address: "합성 주소 오류",
      memo: "합성 메모 오류",
    };
    const wrapper = mount(CustomerFormDialog, {
      props: { open: true, errors },
      global: { stubs: { AppDialog: dialogStub } },
    });

    const fields = [
      ["name", "customer-name-error"],
      ["birthDate", "customer-birthDate-error"],
      ["gender", "customer-gender-error"],
      ["phone", "customer-phone-error"],
      ["status", "customer-status-error"],
      ["address", "customer-address-error"],
      ["memo", "customer-memo-error"],
    ] as const;

    for (const [field, errorId] of fields) {
      const control = wrapper.get(`[name='${field}']`);
      expect(control.attributes("aria-invalid")).toBe("true");
      expect(control.attributes("aria-describedby")?.split(" ")).toContain(errorId);
      expect(wrapper.get(`#${errorId}`).text()).toBe(errors[field]);
    }

    expect(wrapper.get("textarea[name='memo']").attributes("aria-describedby")?.split(" "))
      .toEqual(["customer-memo-privacy", "customer-memo-error"]);
    expect(wrapper.get("#customer-memo-privacy").text()).toContain("주민등록번호");
    wrapper.unmount();
  });
});
