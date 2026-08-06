import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

import RestoreConfirmDialog from "../components/RestoreConfirmDialog.vue";

afterEach(() => { document.body.innerHTML = ""; });

const preview = {
  token: "12000000-0000-4000-8000-000000000001",
  basename: "synthetic.bodam-backup",
  createdAt: "2026-08-07T03:00:00.000Z",
  appVersion: "0.1.0",
  schemaVersion: "20260806080000_add_app_settings",
  reason: "manual" as const,
};

describe("RestoreConfirmDialog", () => {
  it("focuses safe cancellation and blocks every dismiss path while restoring", async () => {
    const wrapper = mount(RestoreConfirmDialog, {
      attachTo: document.body,
      props: { open: true, preview, restoring: false, discarding: false },
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));
    expect(document.activeElement?.textContent).toContain("취소");

    await wrapper.setProps({ restoring: true });
    const dialog = document.querySelector("dialog");
    dialog?.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(document.body.textContent).toContain("현재 데이터로 되돌립니다");
    wrapper.unmount();
  });

  it("blocks dismiss and confirm while a preview discard is pending", async () => {
    const wrapper = mount(RestoreConfirmDialog, {
      attachTo: document.body,
      props: { open: true, preview, restoring: false, discarding: true },
    });
    await new Promise((resolve) => requestAnimationFrame(resolve));

    const dialog = document.querySelector("dialog");
    dialog?.dispatchEvent(new Event("cancel", { cancelable: true }));
    expect(wrapper.emitted("close")).toBeUndefined();
    expect(document.querySelector<HTMLButtonElement>("button.is-danger")?.disabled).toBe(true);
    expect(document.body.textContent).toContain("선택을 취소하는 중");
    wrapper.unmount();
  });
});
