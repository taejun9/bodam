import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import BackupRestoreSection from "../components/BackupRestoreSection.vue";

afterEach(() => { document.body.innerHTML = ""; });

describe("BackupRestoreSection browser contract", () => {
  it("shows privacy guidance and keeps every native mutation disabled", async () => {
    const wrapper = mount(BackupRestoreSection, { attachTo: document.body });
    await flushPromises();

    expect(wrapper.text()).toContain("암호화되지 않은 평문");
    expect(wrapper.text()).toContain("설치된 데스크톱 앱에서만");
    for (const label of ["백업 폴더 변경", "기본 위치 사용", "지금 백업", "백업에서 복원"]) {
      const button = wrapper.findAll("button").find((candidate) => candidate.text() === label);
      expect(button?.attributes("disabled")).toBeDefined();
    }
    expect(wrapper.find("[data-testid='backup-status']").text()).toContain("0 / 30");
    wrapper.unmount();
  });
});
